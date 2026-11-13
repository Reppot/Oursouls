import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError
import catalog_store as store


class CatalogCacheTests(unittest.TestCase):
    def test_cache_and_authoritative_failure(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(store,'URL','https://fixture.invalid'), patch.object(store,'SNAPSHOT_PATH',Path(folder)/'cache.json'), patch.object(store,'_snapshot',None), patch.object(store,'_loaded_at',0), patch.object(store,'_read_products') as load:
            load.return_value=[{'id':'one','published':True}]
            self.assertEqual(store.list_products()[0]['id'],'one')
            store.list_products();self.assertEqual(load.call_count,1)
            load.side_effect=URLError('offline')
            self.assertEqual(store.list_products(force=True)[0]['id'],'one')
            with self.assertRaises(URLError):
                store.list_products(force=True,allow_stale=False)

    def test_outage_without_last_good_does_not_use_seed(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(store,'URL','https://fixture.invalid'), patch.object(store,'SNAPSHOT_PATH',Path(folder)/'none.json'), patch.object(store,'_snapshot',None), patch.object(store,'_read_products',side_effect=URLError('offline')):
            with self.assertRaises(URLError):store.list_products(force=True)
