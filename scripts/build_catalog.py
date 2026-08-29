#!/usr/bin/env python3
"""
Merges data/_raw_structure.json (name, url, image, rarity color — from
scripts/crawl_catalog.py) with data/_prices_raw.json (price, compare-at,
stock — collected via a JS-executing browser since bloxcart.com does not
server-render pricing) into the final data/catalog.json.

Also derives: product_slug, game display name, a clean Shopify handle,
and a numeric price/compare_at in cents for CSV/import use.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GAME_NAMES = {
    "murder-mystery-2": "Murder Mystery 2",
    "steal-a-brainrot": "Steal a Brainrot",
    "blox-fruits": "Blox Fruits",
    "pet-simulator-99": "Pet Simulator 99",
    "blade-ball": "Blade Ball",
    "grow-a-garden-2": "Grow a Garden 2",
    "99-nights-in-the-forest": "99 Nights in the Forest",
    "dress-to-impress": "Dress to Impress",
}


def parse_money(text):
    """'CA$1,014.87' -> 101487 (cents). None -> None."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", text)
    if not cleaned:
        return None
    return round(float(cleaned) * 100)


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def main():
    structure = json.loads((ROOT / "data" / "_raw_structure.json").read_text())["products"]
    prices = json.loads((ROOT / "data" / "_prices_raw.json").read_text())

    catalog = []
    missing_price = []
    duplicates = {}

    for p in structure:
        url_path = p["product_url_path"]
        price_row = prices.get(url_path)
        game_slug = p["game_slug"]
        product_slug = slugify(p["product_name"])
        shopify_handle = f"{game_slug}-{product_slug}"

        duplicates.setdefault(shopify_handle, []).append(url_path)

        price_text = compare_text = stock_text = None
        if price_row:
            price_text, compare_text, stock_text = price_row
        else:
            missing_price.append(url_path)

        price_cents = parse_money(price_text)
        compare_cents = parse_money(compare_text)
        available = None
        if stock_text is not None:
            available = stock_text.strip().lower() != "out of stock"

        # Original, un-resized asset filename as it exists on Shopify's CDN
        # (bloxcart.com's own store), e.g. ".../files/65.1.png?v=..."
        source_filename = None
        if p["source_image_url"]:
            # cdn.shopify.com/s/files/1/{shop-id-parts}/files/{actual-filename}
            # — "files" appears twice, so take the segment after the LAST one.
            m = re.search(r"/files/([^/?]+)(?:\?|$)", p["source_image_url"])
            if m:
                source_filename = m.group(1)

        catalog.append(
            {
                "game": GAME_NAMES.get(game_slug, game_slug),
                "game_slug": game_slug,
                "product_name": p["product_name"],
                "product_slug": product_slug,
                "shopify_handle": shopify_handle,
                "category": p["category"],
                "rarity_accent_color": p["rarity_accent_color"],
                "source_url": p["product_url"],
                "source_image_url": p["source_image_url"],
                "source_image_filename": source_filename,
                "price": price_text,
                "price_cents": price_cents,
                "compare_at_price": compare_text,
                "compare_at_price_cents": compare_cents,
                "available": available,
                "currency": "CAD",
            }
        )

    dup_report = {h: urls for h, urls in duplicates.items() if len(urls) > 1}

    (ROOT / "data" / "catalog.json").write_text(json.dumps(catalog, indent=2))

    print(f"Products merged: {len(catalog)}")
    print(f"Missing price/stock data: {len(missing_price)}")
    if missing_price:
        for u in missing_price:
            print("  MISSING:", u)
    print(f"Duplicate handles: {len(dup_report)}")
    if dup_report:
        for h, urls in dup_report.items():
            print("  DUP:", h, urls)
    print("Written to data/catalog.json")


if __name__ == "__main__":
    main()
