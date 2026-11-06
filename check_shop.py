import json
import os
import re
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
from werkzeug.security import generate_password_hash

with TemporaryDirectory(dir=Path.cwd()) as tmp:
    os.environ['LOCAL_DB'] = str(Path(tmp) / 'test.sqlite3')
    os.environ['ADMIN_PASSWORD_HASH'] = generate_password_hash('fixture-only-password')
    import app
    app.app.testing = True
    # Keep the admin upload test in memory and validate the format sent to storage.
    def save_photo(name,data):
        with Image.open(BytesIO(data)) as photo:
            assert photo.format == 'WEBP' and photo.size == (40,50)
        return '/static/test-photo.webp'
    app.store.save_photo = save_photo
    app.store.database().close()
    client = app.app.test_client()
    def token(page):
        return re.search(r'name="csrf" value="([^"]+)"', page.get_data(as_text=True))[1]

    for route in ('/','/catalog/','/catalog/?catalog_page=5','/constructor/','/cart/','/services/','/about/','/health'):
        response = client.get(route)
        assert response.status_code == 200, (route,response.status_code)
        assert '<?php' not in response.get_data(as_text=True)
    studio = client.get('/constructor/').get_data(as_text=True)
    for path in re.findall(r'(?:src|href|data-(?:archive|atlas|sample|viewer))=[\'"](/static/[^\'"]+)',studio):
        assert client.get(path).status_code == 200, path
    seed = app.store.list_products()
    assert len(seed) == 60
    assert len({img for p in seed for img in p['images']}) == 67
    for p in seed:
        for img in p['images']:
            path = Path(img.lstrip('/'))
            with Image.open(path) as im:
                assert im.format == 'WEBP'
                im.verify()
        assert client.get('/product/'+p['slug']+'/').status_code == 200, p['slug']
    assert client.get('/admin/').location == '/admin/login/'
    login = client.get('/admin/login/')
    assert client.post('/admin/login/', data={'user':'owner','password':'wrong'}).status_code == 400
    assert client.post('/admin/login/', data={'user':'owner','password':'wrong','csrf':token(login)}).status_code == 401
    login = client.get('/admin/login/')
    assert client.post('/admin/login/', data={'user':'owner','password':'fixture-only-password','csrf':token(login)}).location == '/admin/'
    admin = client.get('/admin/')
    assert 'Найдено товаров: 60' in admin.get_data(as_text=True)
    assert 'Найдено товаров: 1' in client.get('/admin/?q=OS-PHOTO-115').get_data(as_text=True)

    png = BytesIO()
    Image.new('RGB',(40,50),'green').save(png,'PNG')
    png.seek(0)
    data = {'csrf':token(client.get('/admin/product/new/')),'name':'Футболка для теста','sku':'TEST-001',
            'category':'Тест','color':'Чёрный','price':'2500','sale_price':'1900',
            'published':'on','available':'on','photos':(png,'photo.png')}
    assert client.post('/admin/product/new/',data=data).location == '/admin/'
    p = next(p for p in app.store.list_products() if p['sku']=='TEST-001')
    assert p['price'] == 250000 and p['sale_price'] == 190000 and p['images']
    product = client.get('/product/'+p['slug']+'/')
    assert '1 900 ₽' in product.get_data(as_text=True)
    assert client.post('/cart/',data={'csrf':token(product),'action':'add','id':p['id'],'color':'Чёрный','size':'M','qty':2}).status_code == 302
    basket = client.get('/cart/')
    assert '3 800 ₽' in basket.get_data(as_text=True) and 't.me/oursouls33' in basket.get_data(as_text=True)
    data.pop('photos')
    data.pop('published')
    data.update(csrf=token(client.get('/admin/product/'+p['id']+'/')),name='Скрытая футболка')
    assert client.post('/admin/product/'+p['id']+'/',data=data).status_code == 302
    assert client.get('/product/'+p['slug']+'/').status_code == 404
    assert 'Скрытая футболка' in client.get('/admin/').get_data(as_text=True)
    assert client.post('/admin/logout/',data={'csrf':token(client.get('/admin/'))}).status_code == 302
    assert client.get('/admin/').location == '/admin/login/'
    print('PASS: 60 live products, 67 local images, pages, protected admin, search, photo upload, price, discount, hiding and cart.')
