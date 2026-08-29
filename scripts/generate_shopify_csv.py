#!/usr/bin/env python3
"""
Generates data/shopify-products.csv in Shopify's standard product-import
format from data/catalog.json.

Image Src points at the ORIGINAL bloxcart.com/Shopify-CDN source image
(already public, already proven fetchable — confirmed by
scripts/download_images.py succeeding on all 296), not the locally
processed/normalized copy in assets/catalog/processed/, because Shopify's
CSV importer needs a URL it can fetch over HTTP, and the processed copies
only exist on this local disk. See docs/catalog-audit.md for the plan to
swap in the processed images once Shopify Admin API/Files access exists.

Body (HTML) is intentionally left blank for every row: real product
descriptions were only captured for 1 of 296 products during manual
inspection (Gingerscope Gun) — inventing generic copy for the rest would
violate "don't invent missing information," so this is flagged in
docs/catalog-qc.md as a manual follow-up instead.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
OUT = ROOT / "data" / "shopify-products.csv"

COLUMNS = [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Type",
    "Tags",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Variant SKU",
    "Variant Inventory Tracker",
    "Variant Inventory Qty",
    "Variant Inventory Policy",
    "Variant Fulfillment Service",
    "Variant Price",
    "Variant Compare At Price",
    "Variant Requires Shipping",
    "Variant Taxable",
    "Image Src",
    "Image Position",
    "Image Alt Text",
    "Gift Card",
    "SEO Title",
    "Status",
]


def main():
    catalog = json.loads(CATALOG.read_text())

    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()

        for p in catalog:
            tags = [f"game:{p['game_slug']}", f"category:{p['category']}"]
            if p.get("rarity_name") and not p.get("rarity_ambiguous"):
                tags.append(f"rarity:{p['rarity_name']}")

            price = f"{p['price_cents'] / 100:.2f}" if p["price_cents"] is not None else ""
            compare_at = (
                f"{p['compare_at_price_cents'] / 100:.2f}" if p.get("compare_at_price_cents") is not None else ""
            )
            available = p.get("available")
            qty = 10 if available else 0  # binary stock signal only — see docs/catalog-qc.md

            writer.writerow(
                {
                    "Handle": p["shopify_handle"],
                    "Title": p["product_name"],
                    "Body (HTML)": "",
                    "Vendor": "BloxCart",
                    "Type": p["game"],
                    "Tags": ", ".join(tags),
                    "Published": "TRUE",
                    "Option1 Name": "Title",
                    "Option1 Value": "Default Title",
                    "Variant SKU": p["shopify_handle"],
                    "Variant Inventory Tracker": "shopify",
                    "Variant Inventory Qty": qty,
                    "Variant Inventory Policy": "deny",
                    "Variant Fulfillment Service": "manual",
                    "Variant Price": price,
                    "Variant Compare At Price": compare_at,
                    "Variant Requires Shipping": "FALSE",
                    "Variant Taxable": "TRUE",
                    "Image Src": p["source_image_url"] or "",
                    "Image Position": 1,
                    "Image Alt Text": p["product_name"],
                    "Gift Card": "FALSE",
                    "SEO Title": f"{p['product_name']} · {p['game']} | BloxCart",
                    "Status": "active",
                }
            )

    print(f"Wrote {len(catalog)} rows to {OUT}")


if __name__ == "__main__":
    main()
