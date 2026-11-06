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

from flask import Flask, abort, flash, g, redirect, render_template, request, session, url_for
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.security import check_password_hash

import catalog_store as store

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
                colors=COLORS, cart_count=sum(i['qty'] for i in session.get('cart', [])))

@app.template_filter('rub')
def rub(cents):
    return f'{Decimal(cents)/100:,.2f}'.replace(',', ' ').replace('.', ',').removesuffix(',00') + ' ₽'

def products():
    if 'products' not in g:
        g.products = store.list_products()
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
    return render_template('home.html', title='Одежда и печать', products=public_products()[:4])

@app.get('/services/')
def services():
    return render_template('services.html', title='Печать')

@app.get('/about/')
def about():
    return render_template('about.html', title='О бренде')

@app.get('/constructor/')
def constructor():
    return render_template('constructor.html', title='Конструктор')

@app.get('/catalog/')
def catalog():
    items = public_products()
    categories = sorted({p['category'] for p in items})
    category = request.args.get('category', '')
    filtered = [p for p in items if not category or p['category'] == category]
    pages = max(1, (len(filtered) + 11)//12)
    page = min(pages, max(1, request.args.get('catalog_page', 1, type=int)))
    return render_template('catalog.html', title='Каталог', products=filtered[(page-1)*12:page*12],
                           count=len(filtered), categories=categories, category=category, page=page, pages=pages)

@app.get('/product/<slug>/')
def product(slug):
    item = next((p for p in public_products() if p['slug'] == slug), None)
    if item is None:
        abort(404)
    return render_template('product.html', title=item['name'], p=item)

@app.route('/cart/', methods=['GET','POST'])
def cart():
    items = {p['id']:p for p in public_products() if p['available']}
    basket = [i for i in session.get('cart', []) if i['id'] in items]
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
            if key not in items or size not in SIZES or color not in COLORS:
                abort(400)
            existing = next((i for i in basket if (i['id'],i['size'],i['color']) == (key,size,color)), None)
            if existing:
                existing['qty'] = min(9999, existing['qty'] + qty)
            elif len(basket) < 20:
                basket.append(dict(id=key,size=size,color=color,qty=qty))
            else:
                flash('В корзине до 20 разных позиций.')
        session['cart'] = basket
        return redirect(url_for('cart'))
    text = 'Здравствуйте! Хочу оформить заказ Our Souls:\n' + '\n'.join(
        f"• {items[i['id']]['name']} — {i['size']}, {i['color']}, {i['qty']} шт." for i in basket)
    total = 0
    for i in basket:
        p = items[i['id']]
        price = p['sale_price'] if p['sale_price'] is not None else p['price']
        if price is None:
            total = None
            break
        total += price*i['qty']
    return render_template('cart.html', title='Корзина', lines=[(i,items[i['id']]) for i in basket],
                           order_text=text, total=total, checkout=TELEGRAM + '?' + urlencode({'text':text}))

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
        for field, length in [('name',150),('sku',80),('category',80),('description',6000)]:
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
            kept = [image for index,image in enumerate(p['images']) if str(index) not in request.form.getlist('remove')]
            photos = [photo for photo in request.files.getlist('photos') if photo.filename]
            if not 1 <= len(kept)+len(photos) <= 8:
                raise ValueError('У карточки должно быть от 1 до 8 фотографий.')
            encoded = [photo_bytes(photo) for photo in photos]
            p['images'] = kept + [store.save_photo(sha256(data).hexdigest()+'.webp',data) for data in encoded]
            if not existing:
                p['id'] = secrets.token_hex(8)
                p['slug'] = 'our-souls-' + p['id']
            store.write_product(p)
            flash('Карточка сохранена.')
            return redirect(url_for('admin_catalog'))
        except ValueError as exc:
            error = str(exc)
    return render_template('edit.html', title='Карточка товара', p=p, key=key, error=error,
                           categories=sorted({item['category'] for item in products()})), 400 if error else 200

if __name__ == '__main__':
    app.run(port=8780)
