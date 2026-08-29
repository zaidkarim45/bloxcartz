#!/usr/bin/env python3
"""Generates data/product-image-map.json — deterministic BloxCart product
-> BloxxCart Shopify handle -> local asset mapping, per Step 10 of the
migration request."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
OUT = ROOT / "data" / "product-image-map.json"


def main():
    catalog = json.loads(CATALOG.read_text())
    mapping = {}
    for p in catalog:
        # Keyed by shopify_handle, not product_slug: a few product NAMES repeat
        # across different games (e.g. "Laser Gun" exists in both Murder
        # Mystery 2 and Steal a Brainrot; "2x Money" in both Blox Fruits and
        # Dress to Impress) — shopify_handle is prefixed with game_slug so it
        # stays unique, product_slug alone does not.
        mapping[p["shopify_handle"]] = {
            "source_product": p["product_name"],
            "game": p["game"],
            "game_slug": p["game_slug"],
            "category": p["category"],
            "shopify_handle": p["shopify_handle"],
            "source_url": p["source_url"],
            "source_image_url": p["source_image_url"],
            "raw_asset": p.get("raw_asset_path"),
            "processed_png": p.get("processed_png_path"),
            "processed_webp": p.get("processed_webp_path"),
        }
    OUT.write_text(json.dumps(mapping, indent=2))
    print(f"Wrote {len(mapping)} entries to {OUT}")


if __name__ == "__main__":
    main()
