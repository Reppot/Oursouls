import hashlib,json,unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
class RackAssetTests(unittest.TestCase):
    def test_every_catalog_front_has_a_current_mask_and_ready_image(self):
        products=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
        masks=json.loads((ROOT/'static/rack/mask-manifest.json').read_text())
        cutouts=json.loads((ROOT/'static/rack/cutouts.json').read_text())
        for product in products:
            if not product.get('published',True):continue
            front=product['images'][0]
            with self.subTest(product=product['name']):
                self.assertIn(front,masks)
                record=masks[front]
                self.assertEqual(cutouts[front],record['image'])
                source=ROOT/front.lstrip('/')
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),record['source_sha256'])
                with Image.open(ROOT/record['mask'].lstrip('/')) as mask:
                    self.assertEqual(mask.mode,'L')
                    self.assertEqual(list(mask.size),record['original_size'])
                    self.assertEqual(mask.getextrema(),(0,255))
                with Image.open(ROOT/record['image'].lstrip('/')) as ready:
                    self.assertIn('A',ready.getbands())
                self.assertTrue(record['rgb_preserved_in_master'])
