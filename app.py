from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from hmac import compare_digest
from io import BytesIO
import os
import secrets
import time
from threading import Lock
from urllib.error import URLError
from urllib.parse import urlencode

from flask import Flask, abort, flash, g, redirect, render_template, request, session, url_for, jsonify, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.security import check_password_hash

import catalog_store as store
from product_schema import RACK_CUTOUTS, normalize_product, validate_variant_selection, valid_hex, cart_variant_id

app = Flask(__name__)
deployed = bool(os.getenv('RENDER'))
admin_hash = os.getenv('ADMIN_PASSWORD_HASH', '')
if deployed and (not admin_hash or len(os.getenv('SESSION_SECRET', '')) < 32):
    raise RuntimeError('Set ADMIN_PASSWORD_HASH and SESSION_SECRET.')
app.config.update(SECRET_KEY=os.getenv('SESSION_SECRET') or secrets.token_hex(32),
                  SESSION_COOKIE_SECURE=deployed, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE='Lax', MAX_CONTENT_LENGTH=24*1024*1024,
                  PERMANENT_SESSION_LIFETIME=timedelta(hours=12))

TELEGRAM = 'https://t.me/oursouls33'
SIZES = ('S','M','L','XL','2XL','3XL')
SWATCHES = {'#202321':'Чёрный','#f7f7f2':'Белый','#294531':'Тёмно-зелёный','#a6a0bf':'Сиреневый',
            '#742a36':'Бордовый','#777c79':'Серый','#23344d':'Тёмно-синий','#d4bea1':'Бежевый'}
COLORS = (*SWATCHES.values(), 'Хаки')
ADMIN_USER = os.getenv('ADMIN_USER', 'owner')
ATTEMPTS = []
ATTEMPT_LOCK = Lock()

def csrf():
    if 'csrf' not in session:
        session['csrf'] = secrets.token_urlsafe(32)
    return session['csrf']

@app.before_request
def protect_forms():
    if request.method == 'POST' and not compare_digest(request.form.get('csrf', '').encode(), session.get('csrf', '-').encode()):
        abort(400)
    if request.path.startswith('/admin/') and request.endpoint != 'login' and not session.get('admin'):
        return redirect(url_for('login'))

@app.after_request
def protect_response(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if request.path.startswith('/admin/'):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Robots-Tag'] = 'noindex'
    return response

@app.context_processor
def shared():
    return dict(telegram=TELEGRAM, year=datetime.now().year, csrf=csrf, sizes=SIZES, swatches=SWATCHES,
                colors=COLORS, cart_count=sum(i['qty'] for i in session.get('cart', [])), catalog_stale=store.catalog_stale(),
                public_base=os.getenv('PUBLIC_BASE_URL','https://our-souls-shop.onrender.com').rstrip('/'))

@app.template_filter('rub')
def rub(cents):
    return f'{Decimal(cents)/100:,.2f}'.replace(',', ' ').replace('.', ',').removesuffix(',00') + ' ₽'

def products():
    if 'products' not in g:
        fresh = request.path.startswith('/admin/') or request.endpoint in ('cart','validate_cart')
        g.products = [normalize_product(p) for p in store.list_products(force=fresh,allow_stale=not fresh)]
    return g.products

def public_products():
    return [p for p in products() if p['published']]

@app.errorhandler(URLError)
def backend_unavailable(error):
    return render_template('message.html', title='Каталог временно недоступен',
                           message='Подожди немного и обнови страницу.'), 503

@app.get('/health')
def health():
    return 'ok'

@app.get('/')
def home():
    featured = sorted(public_products(), key=lambda p:(not p['home_featured'], p['home_position'] if p['home_featured'] else p['position']))
    return render_template('home.html', title='Одежда и печать', products=featured)

@app.route('/services/', methods=['GET', 'POST'])
def services():
    kinds = ('Футболка', 'Худи', 'Лонгслив', 'Шоппер', 'Своя вещь', 'Другое')
    form = {}
    error = None
    field_errors = {}
    if request.method == 'POST':
        for key, length in (('name', 80), ('contact', 100), ('garment', 30), ('quantity', 5), ('details', 600)):
            form[key] = request.form.get(key, '').strip()[:length]
        qty = request.form.get('quantity', type=int)
        if not form['name']: field_errors['name']='Укажи, как к тебе обращаться.'
        if not form['contact']: field_errors['contact']='Укажи Telegram или телефон для связи.'
        if form['garment'] not in kinds: field_errors['garment']='Выбери тип одежды.'
        if not qty or not 1 <= qty <= 9999: field_errors['quantity']='Укажи количество от 1 до 9999.'
        if field_errors:
            error = 'Проверь отмеченные поля.'
        else:
            message = (
                f"Здравствуйте! Хочу заказать печать.\nИмя: {form['name']}\n"
                f"Контакт: {form['contact']}\nОдежда: {form['garment']}\nТираж: {qty} шт."
            )
            if form['details']:
                message += '\nОписание: ' + form['details']
            return redirect(TELEGRAM + '?' + urlencode({'text': message}), code=303)
    return render_template('services.html', title='Печать', kinds=kinds, form=form, error=error,field_errors=field_errors, service_cutout=RACK_CUTOUTS.get('/static/catalog/12.webp','/static/catalog/12.webp')), 400 if error else 200

@app.get('/about/')
def about():
    return render_template('about.html', title='О бренде')

@app.get('/constructor/')
def constructor():
    if 'try' in request.args:
        return redirect(url_for('constructor'), code=302)
    return render_template('constructor.html', title='Конструктор')

@app.get('/catalog/')
def catalog():
    items = public_products()
    categories = sorted({p['category'] for p in items})
    palette = {v['color_name']:v['color_hex'] for p in items for v in p['variants']}
    category = request.args.get('category', '')
    colors = [name for name in request.args.getlist('color') if name in palette]
    search = request.args.get('q', '').strip()[:100]
    sort = request.args.get('sort', '')
    if sort not in ('new', 'price-up', 'price-down'):
        sort = ''
    minimum = request.args.get('min', type=int)
    maximum = request.args.get('max', type=int)
    has_prices = any(p['price'] is not None for p in items)
    if not has_prices:
        minimum = maximum = None
        if sort in ('price-up', 'price-down'):
            sort = ''
    if minimum is not None and minimum < 0:
        minimum = None
    if maximum is not None and maximum < 0:
        maximum = None
    if minimum is not None and maximum is not None and minimum > maximum:
        minimum, maximum = maximum, minimum

    def current_price(item):
        return item['sale_price'] if item['sale_price'] is not None else item['price']

    filtered = [p for p in items if
                (not category or p['category'] == category)
                and (not colors or any(v['color_name'] in colors for v in p['variants']))
                and (not search or search.casefold() in f"{p['name']} {p['category']} {p['sku']}".casefold())]
    if minimum is not None:
        filtered = [p for p in filtered if current_price(p) is not None and current_price(p) >= minimum * 100]
    if maximum is not None:
        filtered = [p for p in filtered if current_price(p) is not None and current_price(p) <= maximum * 100]
    if sort == 'new':
        filtered.reverse()
    if sort in ('price-up', 'price-down'):
        factor = 1 if sort == 'price-up' else -1
        filtered.sort(key=lambda p: (current_price(p) is None, factor * (current_price(p) or 0)))

    per_page = 12
    pages = max(1, (len(filtered) + per_page - 1) // per_page)
    page = min(pages, max(1, request.args.get('catalog_page', 1, type=int)))
    params = [(key, value) for key, value in (
        ('category', category), ('q', search), ('sort', sort), ('min', minimum), ('max', maximum)
    ) if value not in (None, '')] + [('color', color) for color in colors]
    return render_template('catalog.html', title='Каталог', products=filtered[(page-1)*per_page:page*per_page],
                           count=len(filtered), categories=categories, category=category, palette=palette,
                           selected_colors=colors, search=search, sort=sort, minimum=minimum, maximum=maximum,
                           pagination={n: '?' + urlencode(params + [('catalog_page', n)]) for n in range(1,pages+1)},
                           page=page, pages=pages, has_prices=has_prices)

@app.get('/product/<slug>/')
def product(slug):
    item = next((p for p in public_products() if p['slug'] == slug), None)
    if item is None:
        abort(404)
    variant = next((v for v in item['variants'] if v['id']==request.args.get('variant')), item['variants'][0])
    base=os.getenv('PUBLIC_BASE_URL','https://our-souls-shop.onrender.com').rstrip('/')
    metadata={'@context':'https://schema.org','@type':'Product','name':item['name'],'description':item['description'],
              'sku':item['sku'],'image':[u if u.startswith('https://') else base+u for u in item['images']],
              'brand':{'@type':'Brand','name':'Our Souls'}}
    price=item['sale_price'] if item['sale_price'] is not None else item['price']
    if price is not None:
        metadata['offers']={'@type':'Offer','priceCurrency':'RUB','price':f'{price/100:.2f}','url':base+url_for('product',slug=item['slug'])}
    return render_template('product.html', title=item['name'], p=item, variant=variant,product_jsonld=metadata)

@app.route('/cart/', methods=['GET','POST'])
def cart():
    items = {p['id']:p for p in public_products() if p['available']}
    basket = list(session.get('cart', []))
    def valid_line(line):
        p=items.get(line['id'])
        if not p:
            return False
        try:
            variant=validate_variant_selection(p,cart_variant_id(p,line),line['size'])
            line['variant_id']=variant['id']
            line['color']=variant['color_name']
            return True
        except ValueError:
            return False
    def clean_basket():
        valid=[line for line in basket if valid_line(line)]
        if len(valid)!=len(basket):
            flash('Недоступные товары или варианты убраны из корзины. Остальные позиции сохранены.')
        return valid
    if request.method == 'POST':
        action = request.form.get('action')
        qty = min(9999, max(1, request.form.get('qty', 1, type=int)))
        index = request.form.get('index', -1, type=int)
        if action in ('remove','update') and 0 <= index < len(basket):
            if action == 'remove':
                basket.pop(index)
            else:
                basket[index]['qty'] = qty
        elif action == 'add':
            key, size, color = (request.form.get(k) for k in ('id','size','color'))
            if key not in items:
                abort(400)
            variant_id = request.form.get('variant_id')
            if not variant_id:
                variant_id = next((v['id'] for v in items[key]['variants'] if v['color_name']==color), '')
            try:
                variant = validate_variant_selection(items[key],variant_id,size)
            except ValueError as exc:
                flash(str(exc))
                return redirect(url_for('product',slug=items[key]['slug']))
            color = variant['color_name']
            existing = next((i for i in basket if (i['id'],i['size'],i.get('variant_id')) == (key,size,variant_id)), None)
            if existing:
                existing['qty'] = min(9999, existing['qty'] + qty)
            elif len(basket) < 20:
                basket.append(dict(id=key,size=size,color=color,qty=qty,variant_id=variant_id))
            else:
                flash('В корзине до 20 разных позиций.')
        session['cart'] = clean_basket()
        return redirect(url_for('cart'))
    basket=clean_basket()
    session['cart']=basket
    text = 'Здравствуйте! Хочу оформить заказ Our Souls:\n' + '\n'.join(
        f"• {items[i['id']]['name']} — {i['size']}, {i['color']}, {i['qty']} шт." for i in basket)
    total = 0
    lines = []
    for i in basket:
        p = items[i['id']]
        price = p['sale_price'] if p['sale_price'] is not None else p['price']
        subtotal = price * i['qty'] if price is not None else None
        lines.append((i, p, subtotal))
        if subtotal is None:
            total = None
        elif total is not None:
            total += subtotal
    cart_data = [dict(id=i['id'],variant_id=i.get('variant_id',p['variants'][0]['id']),name=p['name'],
                     size=i['size'],color=i['color'],quantity=i['qty'],url=url_for('product',slug=p['slug']),
                     price=p['sale_price'] if p['sale_price'] is not None else p['price']) for i,p,_ in lines]
    return render_template('cart.html', title='Корзина', lines=lines, cart_data=cart_data,
                           order_text=text, total=total, checkout=TELEGRAM + '?' + urlencode({'text':text}))


@app.post('/api/cart/validate/')
def validate_cart():
    items = {p['id']:p for p in public_products()}
    errors, result = [], []
    for line in session.get('cart', []):
        p = items.get(line['id'])
        try:
            if not p:
                raise ValueError('Товар больше не опубликован.')
            v = validate_variant_selection(p,cart_variant_id(p,line),line['size'])
            if line.get('color')!=v['color_name']:
                raise ValueError('Параметры товара изменились. Открой корзину и проверь выбранный цвет.')
            result.append(dict(id=p['id'],name=p['name'],size=line['size'],color=v['color_name'],
                quantity=line['qty'],variant_id=v['id'],price=p['sale_price'] if p['sale_price'] is not None else p['price']))
        except ValueError as exc:
            errors.append(str(exc))
    return jsonify(items=result,errors=errors), 409 if errors else 200


@app.get('/sitemap.xml')
def sitemap():
    from xml.sax.saxutils import escape
    base = os.getenv('PUBLIC_BASE_URL','https://our-souls-shop.onrender.com').rstrip('/')
    paths = ['/','/catalog/','/constructor/','/services/','/about/'] + [url_for('product',slug=p['slug']) for p in public_products()]
    body = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    body += ''.join('<url><loc>'+escape(base+path)+'</loc></url>' for path in paths) + '</urlset>'
    return Response(body,mimetype='application/xml')


@app.get('/ready')
def ready():
    try:
        return jsonify(ready=bool(products()))
    except URLError:
        return jsonify(ready=False),503


@app.get('/robots.txt')
def robots():
    base=os.getenv('PUBLIC_BASE_URL','https://our-souls-shop.onrender.com').rstrip('/')
    return Response('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: '+base+'/sitemap.xml\n',mimetype='text/plain')

@app.route('/admin/login/', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        if not admin_hash:
            abort(503)
        now = time.monotonic()
        with ATTEMPT_LOCK:
            ATTEMPTS[:] = [t for t in ATTEMPTS if now-t < 600]
            if len(ATTEMPTS) >= 25:
                return render_template('login.html', title='Вход', error='Слишком много попыток. Попробуй через 10 минут.'), 429
            ATTEMPTS.append(now)
        password = request.form.get('password','')
        user = request.form.get('user','')
        valid = len(password) <= 512 and check_password_hash(admin_hash, password)
        if valid and compare_digest(user.encode(), ADMIN_USER.encode()):
            basket = session.get('cart', [])
            session.clear()
            session.update(admin=True, cart=basket)
            session.permanent = True
            return redirect(url_for('admin_catalog'))
        return render_template('login.html', title='Вход', error='Неверный логин или пароль.'), 401
    return render_template('login.html', title='Вход')

@app.post('/admin/logout/')
def logout():
    session.pop('admin', None)
    session.pop('csrf', None)
    return redirect(url_for('login'))

@app.get('/admin/')
def admin_catalog():
    term = request.args.get('q', '').strip().casefold()
    items = [p for p in products() if not term or term in f"{p['name']} {p['sku']} {p['category']}".casefold()]
    return render_template('admin.html', title='Управление каталогом', products=items)

def price_value(field):
    raw = request.form.get(field,'').strip().replace(',','.')
    if not raw:
        return None
    try:
        value = Decimal(raw)
        if not value.is_finite() or not 0 <= value <= 1000000 or value*100 != (value*100).to_integral_value():
            raise ValueError
        return int(value*100)
    except (InvalidOperation, ValueError):
        raise ValueError('Цена должна быть числом от 0 до 1 000 000 ₽ с точностью до копейки.')

def photo_bytes(file):
    try:
        with Image.open(file.stream, formats=('PNG','JPEG','WEBP')) as image:
            if image.width * image.height > 25_000_000:
                raise ValueError
            picture = ImageOps.exif_transpose(image)
            picture.thumbnail((1600, 1600))
            out = BytesIO()
            picture.convert('RGBA' if 'A' in picture.getbands() else 'RGB').save(out,'WEBP',quality=88)
            return out.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise ValueError('Выбери читаемое фото JPG, PNG или WebP до 25 мегапикселей.')

@app.route('/admin/product/<key>/', methods=['GET','POST'])
def admin_product(key):
    existing = next((p for p in products() if p['id'] == key), None)
    if key != 'new' and existing is None:
        abort(404)
    p = dict(existing) if existing else dict(name='', sku='', category='', description='', price=None,
                sale_price=None, images=[], color='Чёрный', published=True, available=True,
                position=max((p['position'] for p in products()), default=-1)+1)
    error = None
    if request.method == 'POST':
        for field, length in [('name',150),('sku',80),('category',80),('description',6000),('material',600),('care',1000)]:
            p[field] = request.form.get(field,'').strip()[:length]
        p['color'] = request.form.get('color')
        p['published'] = 'published' in request.form
        p['available'] = 'available' in request.form
        try:
            if not p['name'] or not p['category'] or p['color'] not in COLORS:
                raise ValueError('Укажи название, категорию и цвет.')
            p['price'], p['sale_price'] = price_value('price'), price_value('sale_price')
            if p['sale_price'] is not None and (p['price'] is None or p['sale_price'] >= p['price']):
                raise ValueError('Цена со скидкой должна быть ниже обычной.')
            measurements = dict(p.get('fit_measurements', {}))
            if 'fit_measurements_present' in request.form:
                measurements = {}
                for size in SIZES:
                    raw = request.form.get(f'fit_{size}', '').strip()
                    if not raw:
                        continue
                    width = request.form.get(f'fit_{size}', type=float)
                    if width is None or not 25 <= width <= 100:
                        raise ValueError(f'Укажи ширину изделия от 25 до 100 см для {size}.')
                    measurements[size] = width
            p['fit_measurements'] = measurements
            order=request.form.getlist('photo_order') or list(map(str,range(len(p['images']))))
            if sorted(order)!=sorted(map(str,range(len(p['images'])))):
                raise ValueError('Некорректный порядок фотографий. Обнови страницу.')
            kept = [p['images'][int(index)] for index in order if index not in request.form.getlist('remove')]
            photos = [photo for photo in request.files.getlist('photos') if photo.filename]
            if not kept and not photos:
                fallback = next((request.files.get('v'+i+'_front') for i in request.form.getlist('variant_index')
                                 if i.isdecimal() and request.files.get('v'+i+'_front') and request.files.get('v'+i+'_front').filename),None)
                if fallback:
                    photos=[fallback]
            if not 1 <= len(kept)+len(photos) <= 8:
                raise ValueError('У карточки должно быть от 1 до 8 фотографий.')
            encoded = [photo_bytes(photo) for photo in photos]
            p['images'] = kept + [store.save_photo(sha256(data).hexdigest()+'.webp',data) for data in encoded]
            if not existing:
                p['id'] = secrets.token_hex(8)
                p['slug'] = 'our-souls-' + p['id']
            if 'variants_present' in request.form:
                variants, old = [], {v['id']:v for v in p.get('variants',[])}
                indices = request.form.getlist('variant_index')
                if not 1 <= len(indices) <= 16 or len(set(indices)) != len(indices):
                    raise ValueError('Добавь от одного до 16 вариантов.')
                for index in indices:
                    if not index.isdecimal() or len(index)>3:
                        raise ValueError('Некорректный вариант.')
                    prefix = 'v'+index+'_'
                    if request.form.get(prefix+'remove'):
                        continue
                    ident = request.form.get(prefix+'id','')
                    prior = old.get(ident,{})
                    name = request.form.get(prefix+'color','').strip()[:60]
                    color_hex = request.form.get(prefix+'hex','').strip()
                    status = request.form.get(prefix+'availability','on_request')
                    selected_sizes = request.form.getlist(prefix+'size')
                    if not name or not valid_hex(color_hex) or status not in ('in_stock','on_request','unavailable'):
                        raise ValueError('Проверь название цвета, HEX и наличие варианта '+str(int(index)+1)+'.')
                    if any(s not in SIZES for s in selected_sizes) or (not selected_sizes and status!='unavailable'):
                        raise ValueError('Выбери размеры для варианта «'+name+'».')
                    images = dict(prior.get('images',{}))
                    images.setdefault('front',p['images'][0]);images.setdefault('back',None);images.setdefault('details',[])
                    if existing and images['front']==existing['images'][0]:
                        images['front']=p['images'][0]
                    if existing and images['details']==existing['images'][1:]:
                        images['details']=p['images'][1:]
                    rack = prior.get('rack_image')
                    for field in ('front','back','rack'):
                        upload = request.files.get(prefix+field)
                        if upload and upload.filename:
                            data = photo_bytes(upload)
                            path = store.save_photo(sha256(data).hexdigest()+'.webp',data)
                            if field=='rack': rack=path
                            else: images[field]=path
                    if request.form.get(prefix+'clear_rack'):rack=None
                    variants.append(dict(id=ident if ident in old else secrets.token_hex(8),color_name=name,
                        color_hex=color_hex.lower(),sizes=list(dict.fromkeys(selected_sizes)),availability=status,
                        images=images,rack_image=rack))
                if not variants:
                    raise ValueError('У товара должен остаться хотя бы один вариант.')
                p['variants']=variants
                p['home_featured']='home_featured' in request.form
                p['home_position']=max(0,min(9999,request.form.get('home_position',0,type=int)))
                p['garment_type']=request.form.get('garment_type','tee')
                if p['garment_type'] not in ('tee','long','hoodie'):
                    raise ValueError('Выбери тип изделия.')
                p['schema_version']=2
            elif existing and p.get('variants') and len(p['variants'])==1 and p['variants'][0]['id'].startswith('legacy-'):
                p['variants'][0]['images']['front']=p['images'][0]
            store.write_product(p)
            flash('Карточка сохранена.')
            return redirect(url_for('admin_catalog'))
        except ValueError as exc:
            error = str(exc)
            if 'variants_present' in request.form:
                old={v['id']:v for v in p.get('variants',[])}
                submitted=[]
                for index in request.form.getlist('variant_index')[:16]:
                    if not index.isdecimal() or len(index)>3:
                        continue
                    prefix='v'+index+'_'
                    prior=old.get(request.form.get(prefix+'id'),{})
                    submitted.append(dict(id=prior.get('id',''),color_name=request.form.get(prefix+'color','')[:60],
                        color_hex=request.form.get(prefix+'hex','')[:7],sizes=request.form.getlist(prefix+'size'),
                        availability=request.form.get(prefix+'availability','on_request'),
                        images=prior.get('images',dict(front=p['images'][0] if p['images'] else '',back=None,details=[])),rack_image=prior.get('rack_image')))
                p['variants']=submitted
    return render_template('edit.html', title='Карточка товара', p=p, key=key, error=error,
                           categories=sorted({item['category'] for item in products()})), 400 if error else 200

if __name__ == '__main__':
    app.run(port=8780)
