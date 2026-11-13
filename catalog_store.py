from contextlib import closing
import json
import os
import sqlite3
import time
import tempfile
from threading import RLock
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
SEED = json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))
URL = os.getenv('SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SECRET_KEY', '')
SNAPSHOT_PATH = ROOT / '.catalog-last-good.json'
_lock = RLock()
_snapshot = None
_loaded_at = 0
_stale = False

if bool(URL) != bool(KEY) or (os.getenv('RENDER') and not URL):
    raise RuntimeError('Set SUPABASE_URL and SUPABASE_SECRET_KEY before deploying.')

def supabase(path, method='GET', payload=None, **headers):
    base = {'apikey': KEY, **headers}
    if KEY.startswith('eyJ'):
        base['Authorization'] = 'Bearer ' + KEY
    request = Request(URL + path, data=payload, method=method, headers=base)
    with urlopen(request, timeout=12) as response:
        return response.read()

def database():
    conn = sqlite3.connect(os.getenv('LOCAL_DB', ROOT / 'catalog.sqlite3'))
    conn.execute('create table if not exists products (id text primary key, doc text not null)')
    return conn

def _read_products():
    if URL:
        # Page explicitly to stay within the PostgREST response cap.
        rows = []
        for offset in range(0, 10000, 500):
            query = urlencode({'select':'doc','order':'id','limit':500,'offset':offset})
            batch = json.loads(supabase('/rest/v1/osp_products?' + query))
            rows.extend(batch)
            if len(batch) < 500:
                break
    else:
        with closing(database()) as conn, conn:
            rows = [{'doc': json.loads(value)} for value, in conn.execute('select doc from products')]
    merged = {p['id']:p for p in SEED}
    merged.update((row['doc']['id'], row['doc']) for row in rows)
    return sorted(merged.values(), key=lambda p: (p['position'], p['id']))


def list_products(force=False, allow_stale=True):
    """Cache public reads; checkout/admin can require a fresh authoritative read."""
    global _snapshot, _loaded_at, _stale
    if not URL:
        return _read_products()
    with _lock:
        now = time.time()
        if not force and _snapshot is not None and now-_loaded_at < 30:
            return json.loads(json.dumps(_snapshot))
        try:
            result = _read_products()
            _snapshot, _loaded_at, _stale = result, now, False
            try:
                with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=ROOT,delete=False,suffix='.catalog.tmp') as f:
                    json.dump({'at':now,'products':result},f,ensure_ascii=False)
                    temporary = Path(f.name)
                temporary.replace(SNAPSHOT_PATH)
            except OSError:
                pass  # Read-only disk must not make a successful catalog request fail.
            return json.loads(json.dumps(result))
        except (URLError, TimeoutError):
            if not allow_stale:
                raise
            if _snapshot is None:
                try:
                    saved=json.loads(SNAPSHOT_PATH.read_text(encoding='utf-8'))
                    if isinstance(saved['products'],list) and 0 <= now-saved['at'] < 3600:
                        _snapshot, _loaded_at = saved['products'],saved['at']
                except (OSError,ValueError,KeyError,TypeError):
                    pass
            if _snapshot is None or now-_loaded_at > 3600:
                raise
            _stale=True
            return json.loads(json.dumps(_snapshot))


def catalog_stale():
    return _stale

def write_product(doc):
    global _loaded_at
    record = json.dumps(doc, ensure_ascii=False)
    if URL:
        payload = json.dumps({'id':doc['id'],'doc':doc},ensure_ascii=False).encode()
        supabase('/rest/v1/osp_products', 'POST', payload,
                 **{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'})
    else:
        with closing(database()) as conn, conn:
            conn.execute('insert or replace into products values (?, ?)', (doc['id'], record))
    with _lock:
        _loaded_at=0
        # A stale on-disk snapshot must not resurrect this edit after a restart.
        try:
            SNAPSHOT_PATH.unlink(missing_ok=True)
        except OSError:
            pass

def save_photo(name, data):
    if URL:
        supabase('/storage/v1/object/osp-catalog/' + name, 'POST', data,
                 **{'Content-Type':'image/webp','x-upsert':'true'})
        return URL + '/storage/v1/object/public/osp-catalog/' + name
    folder = ROOT / 'static' / 'uploads'
    folder.mkdir(exist_ok=True)
    (folder / name).write_bytes(data)
    return '/static/uploads/' + name
