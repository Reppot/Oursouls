import unittest
from product_schema import normalize_product, validate_variant_selection, RACK_CUTOUTS


class ProductSchemaTests(unittest.TestCase):
    def setUp(self):
        self.seed = dict(id='11', slug='red', name='Red', images=['/static/catalog/12.webp'],
                         color='Чёрный', price=None, sale_price=None, published=True,
                         available=True, fit_measurements={'M': 52.5}, position=0)

    def test_legacy_card_preserves_truth(self):
        p = normalize_product(self.seed)
        for key in self.seed:
            self.assertEqual(p[key], self.seed[key])
        self.assertEqual(len(p['variants']), 1)
        self.assertEqual(p['variants'][0]['availability'], 'on_request')
        self.assertEqual(p['variants'][0]['color_name'], 'Чёрный')

    def test_variant_validation_rejects_unknown_and_hidden(self):
        p = normalize_product(self.seed)
        self.assertEqual(validate_variant_selection(p, 'legacy-11', 'M')['color_name'], 'Чёрный')
        with self.assertRaises(ValueError):
            validate_variant_selection(p, 'pink', 'M')
        p['published'] = False
        with self.assertRaises(ValueError):
            validate_variant_selection(p, 'legacy-11', 'M')

    def test_variants_do_not_share_sizes(self):
        p = normalize_product(self.seed)
        p['variants'][0]['sizes'] = ['L']
        with self.assertRaises(ValueError):
            validate_variant_selection(p, 'legacy-11', 'M')

    def test_derived_rack_photo_is_not_reused_after_front_replacement(self):
        p=normalize_product(self.seed)
        self.assertEqual(p['variants'][0]['rack_image'],RACK_CUTOUTS[self.seed['images'][0]])
        p['variants'][0]['images']['front']='/static/new-product-photo.webp'
        self.assertIsNone(normalize_product(p)['variants'][0]['rack_image'])

    def test_old_generated_alpha_is_upgraded_to_current_mask(self):
        p=normalize_product(self.seed)
        p['variants'][0]['rack_image']='/static/rack/images/obsolete.webp'
        self.assertEqual(normalize_product(p)['variants'][0]['rack_image'],RACK_CUTOUTS[self.seed['images'][0]])

    def test_manually_uploaded_alpha_is_not_overwritten(self):
        p=normalize_product(self.seed)
        p['variants'][0]['rack_image']='/static/uploads/custom-alpha.webp'
        self.assertEqual(normalize_product(p)['variants'][0]['rack_image'],'/static/uploads/custom-alpha.webp')

if __name__ == '__main__':
    unittest.main()
