"""Backward compatible product variants. Prices remain in integer kopecks."""
from copy import deepcopy
import re
import json
from pathlib import Path

_cutouts=Path(__file__).resolve().parent/'static'/'rack'/'cutouts.json'
RACK_CUTOUTS=json.loads(_cutouts.read_text(encoding='utf-8')) if _cutouts.exists() else {}
_derived_cutouts=frozenset(RACK_CUTOUTS.values())

SIZES = ('S', 'M', 'L', 'XL', '2XL', '3XL')
COLOR_HEX = {'Чёрный':'#202321', 'Белый':'#f7f7f2', 'Тёмно-зелёный':'#294531',
             'Сиреневый':'#a6a0bf', 'Бордовый':'#742a36', 'Серый':'#777c79',
             'Тёмно-синий':'#23344d', 'Бежевый':'#d4bea1', 'Хаки':'#686744'}


def normalize_product(doc):
    p = deepcopy(doc)
    p.setdefault('schema_version', 2)
    p.setdefault('garment_type', 'tee')
    p.setdefault('material', '')
    p.setdefault('care', '')
    p.setdefault('home_featured', p.get('position', 999) < 8)
    p.setdefault('home_position', p.get('position', 999))
    if not p.get('variants'):
        photos = p.get('images', [])
        p['variants'] = [dict(id='legacy-'+p['id'], color_name=p.get('color','Чёрный'),
            color_hex=COLOR_HEX.get(p.get('color'), '#202321'), sizes=list(SIZES),
            availability='on_request' if p.get('available') else 'unavailable',
            images=dict(front=photos[0] if photos else '', back=None, details=photos[1:]),
            rack_image=None)]
    for variant in p['variants']:
        default=RACK_CUTOUTS.get(variant['images']['front'])
        if variant.get('rack_image') in _derived_cutouts and variant['rack_image']!=default:
            variant['rack_image']=None
        if not variant.get('rack_image') and default:
            variant['rack_image']=default
    return p


def validate_variant_selection(product, variant_id, size):
    if not product.get('published') or not product.get('available'):
        raise ValueError('Товар сейчас недоступен для заказа.')
    variant = next((v for v in product['variants'] if v['id'] == variant_id), None)
    if not variant or variant.get('availability') == 'unavailable':
        raise ValueError('Этот цвет сейчас недоступен. Выбери другой вариант.')
    if size not in SIZES or size not in variant.get('sizes', []):
        raise ValueError('Этот размер недоступен для выбранного цвета.')
    return variant


def valid_hex(value):
    return bool(re.fullmatch(r'#[0-9a-fA-F]{6}', value or ''))


def cart_variant_id(product, line):
    if line.get('variant_id'):
        return line['variant_id']
    match=next((v['id'] for v in product['variants'] if v['color_name']==line.get('color')),None)
    if not match:
        raise ValueError('Цвет из старой корзины больше не доступен. Выбери актуальный вариант товара.')
    return match


def public_variant(variant):
    return {k: deepcopy(variant.get(k)) for k in
            ('id','color_name','color_hex','sizes','availability','images','rack_image')}
