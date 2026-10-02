import unittest

import pandas as pd

import app
import import_to_supabase as importer


class WooperSkuOptionTests(unittest.TestCase):
    def test_dropdown_uses_only_wooper_inventory_skus(self):
        store = app.DataStore.__new__(app.DataStore)
        inventory = {
            "ASEVI-HOASE028": {"main_category": "Home"},
            "BATH1016-BR-UK": {"main_category": "Bathroom"},
        }
        images = {
            "ASEVI-HOASE028": {"title": "Asevi Spray"},
            "BATH1016-BATH1017-UK": {"title": "Parent listing"},
        }

        options = store.build_supabase_sku_options(inventory, images)

        self.assertEqual(
            [item["sku"] for item in options],
            ["ASEVI-HOASE028", "BATH1016-BR-UK"],
        )
        self.assertEqual(options[0]["title"], "Asevi Spray")

    def test_verified_alias_preserves_image_under_canonical_wooper_sku(self):
        images = {
            "ASEVI-HOASE028-UK": {
                "sku": "ASEVI-HOASE028-UK",
                "title": "Asevi Spray",
                "image_url": "https://example.test/asevi.jpg",
            }
        }
        inventory = {"ASEVI-HOASE028": {"sku": "ASEVI-HOASE028"}}
        mappings = [{
            "platform_sku": "ASEVI-HOASE028",
            "wooper_sku": "ASEVI-HOASE028",
            "mapping_status": "mapped",
        }]

        canonical = app.canonicalize_product_images(images, inventory, mappings)

        self.assertIn("ASEVI-HOASE028-UK", canonical)
        self.assertEqual(canonical["ASEVI-HOASE028"]["title"], "Asevi Spray")

    def test_legacy_image_alias_is_recovered_without_mapping_rows(self):
        images = {
            "ASEVI-HOASE028-UK": {
                "sku": "ASEVI-HOASE028-UK",
                "title": "Asevi Spray",
                "image_url": "https://example.test/asevi.jpg",
            }
        }
        inventory = {"ASEVI-HOASE028": {"sku": "ASEVI-HOASE028"}}

        canonical = app.canonicalize_product_images(images, inventory, [])

        self.assertIn("ASEVI-HOASE028-UK", canonical)
        self.assertEqual(canonical["ASEVI-HOASE028"]["title"], "Asevi Spray")

    def test_importer_prefers_verified_mapping_over_formula_sku(self):
        frame = pd.DataFrame([{
            "Inventory Number": "ASEVI-HOASE028",
            "Unnamed: 25": "ASEVI-HOASE028-UK",
            "Auction Title": "Asevi Spray",
            "Brand": "Asevi",
            "White bg image": "https://example.test/asevi.jpg",
            "Picture URLs": "",
        }])
        mappings = [{
            "platform_sku": "ASEVI-HOASE028",
            "wooper_sku": "ASEVI-HOASE028",
            "mapping_status": "mapped",
        }]

        rows = importer.build_product_images(frame, mappings)

        self.assertEqual(rows[0]["sku"], "ASEVI-HOASE028")


if __name__ == "__main__":
    unittest.main()

