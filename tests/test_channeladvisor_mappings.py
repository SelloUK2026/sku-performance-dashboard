from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd


APP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP_DIR))

import import_to_supabase as importer  # noqa: E402


class ChannelAdvisorMappingTests(unittest.TestCase):
    def test_saved_many_to_one_mappings_are_reused_by_refresh(self):
        source = pd.DataFrame(
            [
                {"Inventory Number": "CA-LISTING-A", "Buy It Now Price": 20},
                {"Inventory Number": "CA-LISTING-B", "Buy It Now Price": 22},
                {"Inventory Number": "RETIRED-CA", "Buy It Now Price": 18},
                {"Inventory Number": "NEW-UNKNOWN", "Buy It Now Price": 25},
                {"Inventory Number": "PARENT-ALL", "Buy It Now Price": 30},
            ]
        )
        mappings = {
            "CA-LISTING-A": {"wooper_sku": "CORE-UK", "status": "mapped"},
            "CA-LISTING-B": {"wooper_sku": "CORE-UK", "status": "mapped"},
            "RETIRED-CA": {"wooper_sku": None, "status": "non_existing"},
            "PARENT-ALL": {"wooper_sku": "CORE-UK", "status": "mapped"},
        }

        with patch.object(importer.pd, "read_excel", return_value=source):
            rows = importer.build_channeladvisor_products(
                inventory_rows=[{"sku": "CORE-UK"}],
                manual_mappings=mappings,
            )

        by_sku = {row["platform_sku"]: row for row in rows}
        self.assertEqual(by_sku["CA-LISTING-A"]["wooper_sku"], "CORE-UK")
        self.assertEqual(by_sku["CA-LISTING-B"]["wooper_sku"], "CORE-UK")
        self.assertEqual(by_sku["CA-LISTING-A"]["mapping_source"], "manual")
        self.assertEqual(by_sku["RETIRED-CA"]["mapping_status"], "non_existing")
        self.assertEqual(by_sku["NEW-UNKNOWN"]["mapping_status"], "unresolved")
        self.assertEqual(by_sku["PARENT-ALL"]["mapping_status"], "non_existing")
        self.assertIsNone(by_sku["PARENT-ALL"]["wooper_sku"])
        self.assertEqual(
            by_sku["PARENT-ALL"]["mapping_source"],
            "parent_sku_rule",
        )

    def test_promotion_snapshot_combines_inventory_arrivals_and_lifetime_metrics(self):
        rows = importer.build_promotion_sku_data(
            inventory_rows=[
                {
                    "sku": "CORE-UK",
                    "main_category": "Furniture",
                    "subcategory": "Tables",
                    "brand": "Levede",
                    "inventory_status": "Normal",
                    "grade_level": 4,
                    "estimated_months_to_sell": 8,
                    "stock_on_hand": 12,
                    "cogs": 10,
                    "suggested_freight": 3.5,
                }
            ],
            sku_master_rows=[
                {"sku": "CORE-UK", "first_arrival_date": "2026-01-10"}
            ],
            container_rows=[
                {"sku": "CORE-UK", "inbound_time": "2025-12-01"}
            ],
            sales_rows=[
                {
                    "sku": "CORE-UK",
                    "sku_qty": 2,
                    "sales_amt": 100,
                    "extra_freight": 5,
                    "promo_rebate": 5,
                    "refund_amt": 4,
                    "resend_amt": 2,
                    "profit_incl_rn": 20,
                }
            ],
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["first_arrival_date"], "2026-01-10")
        self.assertEqual(rows[0]["inventory_status"], "Normal")
        self.assertEqual(rows[0]["net_sales"], 100)
        self.assertAlmostEqual(rows[0]["return_rate"], 0.06)
        self.assertAlmostEqual(rows[0]["lifetime_profit_margin"], 0.2)


if __name__ == "__main__":
    unittest.main()
