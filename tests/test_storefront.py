import os
import json
import re
import tempfile
import unittest
from io import BytesIO
from PIL import Image
from unittest.mock import patch
from werkzeug.security import generate_password_hash
import app as web


class StorefrontTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{'LOCAL_DB':self.folder.name+'/test.sqlite3'})
        self.env.start()
        self.admin=patch.object(web,'admin_hash',generate_password_hash('fixture'))
        self.admin.start()
        web.app.testing=True
        self.client=web.app.test_client()

    def test_home_rack_contains_every_published_product_without_counter(self):
        response=self.client.get('/')
        html=response.get_data(as_text=True)
        payload=re.search(r'<script type="application/json" data-rack-data>(.*?)</script>',html,re.S)
        items=json.loads(payload.group(1))
        expected={p['id'] for p in web.store.list_products() if p.get('published',True)}
        self.assertEqual({p['id'] for p in items},expected)
        self.assertGreater(len(items),12)
        self.assertNotIn('data-rack-count',html)

    def tearDown(self):
        self.admin.stop();self.env.stop();self.folder.cleanup()

    def csrf(self,path):
        text=self.client.get(path).get_data(as_text=True)
        return re.search(r'name="csrf" value="([^"]+)"',text)[1]

    def login(self):
        self.client.post('/admin/login/',data={'csrf':self.csrf('/admin/login/'),'user':'owner','password':'fixture'})

    def test_public_2d_and_price_controls(self):
        home=self.client.get('/').get_data(as_text=True)
        self.assertIn('data-rack-index="7"',home)
        self.assertNotIn('runway.js',home)
        studio=self.client.get('/constructor/').get_data(as_text=True)
        self.assertNotIn('data-viewer=',studio)
        self.assertNotIn('data-fit-mode="avatar"',studio)
        catalog=self.client.get('/catalog/?sort=price-up&min=100').get_data(as_text=True)
        self.assertNotIn('<option value="price-up"',catalog)
        self.assertIn('Товаров: 60',catalog)
        self.assertEqual(self.client.get('/sitemap.xml').status_code,200)

    def test_admin_variants_and_stale_cart(self):
        self.login()
        self.assertEqual(self.client.get('/admin/product/new/').status_code,200)
        p=web.store.list_products()[0]
        data={'csrf':self.csrf('/admin/product/'+p['id']+'/'),'name':p['name'],'sku':p['sku'],
              'category':p['category'],'color':p['color'],'price':'','sale_price':'','published':'on','available':'on',
              'variants_present':'1','variant_index':['0','1'],'garment_type':'tee','home_featured':'on','home_position':'0',
              'v0_id':'legacy-'+p['id'],'v0_color':'Чёрный','v0_hex':'#202321','v0_availability':'on_request','v0_size':['M'],
              'v1_id':'','v1_color':'Сиреневый','v1_hex':'#a6a0bf','v1_availability':'on_request','v1_size':['L']}
        response=self.client.post('/admin/product/'+p['id']+'/',data=data)
        self.assertEqual(response.status_code,302)
        product=next(x for x in web.store.list_products() if x['id']==p['id'])
        self.assertEqual(len(product['variants']),2)
        variant=product['variants'][1]
        self.client.post('/cart/',data={'csrf':self.csrf('/product/'+p['slug']+'/'),'action':'add','id':p['id'],'variant_id':variant['id'],'size':'L','qty':2})
        with self.client.session_transaction() as session:
            self.assertEqual(session['cart'][0]['color'],'Сиреневый')
            csrf=session['csrf']
        result=self.client.post('/api/cart/validate/',data={'csrf':csrf})
        self.assertEqual(result.status_code,200)
        self.assertIsNone(result.json['items'][0]['price'])
        product['variants'][1]['availability']='unavailable';web.store.write_product(product)
        self.assertEqual(self.client.post('/api/cart/validate/',data={'csrf':csrf}).status_code,409)
        basket=self.client.get('/cart/')
        self.assertIn('убраны из корзины',basket.get_data(as_text=True))
        with self.client.session_transaction() as session:
            self.assertEqual(session['cart'],[])
        self.assertEqual(self.client.post('/api/cart/validate/',data={'csrf':csrf}).status_code,200)
        self.assertEqual(self.client.post('/api/cart/validate/',data={}).status_code,400)

    def test_invalid_variant_is_not_added(self):
        p=web.store.list_products()[0]
        self.client.post('/cart/',data={'csrf':self.csrf('/product/'+p['slug']+'/'),'action':'add','id':p['id'],'variant_id':'made-up','size':'M','qty':1})
        with self.client.session_transaction() as session:
            self.assertFalse(session.get('cart'))

    def test_legacy_color_never_silently_changes(self):
        p=web.store.list_products()[0]
        csrf=self.csrf('/product/'+p['slug']+'/')
        with self.client.session_transaction() as session:
            session['cart']=[dict(id=p['id'],size='M',color='Белый',qty=1)]
        result=self.client.post('/api/cart/validate/',data={'csrf':csrf})
        self.assertEqual(result.status_code,409)
        self.assertNotIn('items":[{"color":"Чёрный',result.get_data(as_text=True))
        self.client.get('/cart/')
        with self.client.session_transaction() as session:
            self.assertEqual(session['cart'],[])

    def test_replacing_main_photo_updates_inherited_variant(self):
        self.login();p=web.store.list_products()[0]
        image=BytesIO();Image.new('RGB',(40,50),'green').save(image,'PNG');image.seek(0)
        data={'csrf':self.csrf('/admin/product/'+p['id']+'/'),'name':p['name'],'sku':p['sku'],
              'category':p['category'],'color':p['color'],'price':'','sale_price':'','published':'on','available':'on',
              'variants_present':'1','variant_index':'0','garment_type':'tee','home_position':'0',
              'v0_id':'legacy-'+p['id'],'v0_color':p['color'],'v0_hex':'#202321','v0_availability':'on_request','v0_size':'M',
              'remove':'0','photos':(image,'new.png')}
        with patch.object(web.store,'save_photo',return_value='/static/new.webp'):
            response=self.client.post('/admin/product/'+p['id']+'/',data=data)
        self.assertEqual(response.status_code,302)
        actual=next(x for x in web.store.list_products() if x['id']==p['id'])
        self.assertEqual(actual['images'][0],'/static/new.webp')
        self.assertEqual(actual['variants'][0]['images']['front'],'/static/new.webp')
