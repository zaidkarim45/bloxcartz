#!/usr/bin/env python3
"""
Crawls bloxcart.com's category pages (SSR'd Next.js HTML — no JS execution
needed for this pass) and extracts product name, URL, full-resolution
source image, and rarity accent color per product card.

Price / compare-at-price / stock status are NOT server-rendered on this
site (confirmed by inspection: they render as a loading skeleton in the
raw HTML) — those are collected separately via scripts/crawl_prices.py,
which needs a JS-executing browser, and merged in scripts/build_catalog.py.

Usage: python3 scripts/crawl_catalog.py
Output: data/_raw_structure.json
"""
import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_raw_structure.json"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# Confirmed via Phase 0 sitemap crawl (PHASE_0_EXTRACTION_NOTES.md).
# "All items" / "Best Sellers" tabs are cross-cutting views, not true
# categories, so they're intentionally excluded here to avoid duplicate
# products showing up under two categories.
GAMES = {
    "murder-mystery-2": ["bundles", "guns", "knives", "summer-specials"],
    "steal-a-brainrot": ["brainrots", "gamepasses", "money"],
    "blox-fruits": ["gamepass", "permanent-fruits"],
    "pet-simulator-99": ["gargantuans", "gems", "titanics"],
    "blade-ball": ["tokens"],
    "grow-a-garden-2": ["gears", "pets", "seeds"],
    "99-nights-in-the-forest": ["diamonds"],
    "dress-to-impress": ["gamepasses"],
    # Adopt Me intentionally excluded — confirmed external NeonPets
    # affiliate link only, no internal catalog (Phase 0 finding).
}

CARD_SPLIT_RE = re.compile(
    r'<div aria-hidden="true" class="h-1 w-20 shrink-0 mx-auto rounded-b-full" style="background-color:(#[0-9A-Fa-f]{6})">'
)
HREF_RE = re.compile(r'<a class="contents" href="([^"]+)"')
IMG_RE = re.compile(r'url=([^&"]+)&')
TITLE_RE = re.compile(r'<h2 class="line-clamp-2[^"]*"[^>]*>([^<]+)</h2>')


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_category_page(html, game_slug, category_slug):
    products = []
    parts = CARD_SPLIT_RE.split(html)
    # parts[0] is everything before the first card; then alternating
    # (color, chunk) pairs for each card.
    for i in range(1, len(parts), 2):
        color = parts[i]
        chunk = parts[i + 1] if i + 1 < len(parts) else ""
        href_m = HREF_RE.search(chunk)
        img_m = IMG_RE.search(chunk)
        title_m = TITLE_RE.search(chunk)
        if not (href_m and title_m):
            continue
        url_path = href_m.group(1)
        image_url = urllib.parse.unquote(img_m.group(1)) if img_m else None
        products.append(
            {
                "game_slug": game_slug,
                "category": category_slug,
                "product_name": title_m.group(1).strip(),
                "product_url": "https://bloxcart.com" + url_path,
                "product_url_path": url_path,
                "source_image_url": image_url,
                "rarity_accent_color": color,
            }
        )
    return products


PAGE_SIZE = 24  # confirmed server-render cap; categories under this need no pagination


def fetch_category_all_pages(game_slug, category_slug):
    products = []
    seen_urls = set()
    page = 1
    while True:
        base = f"https://bloxcart.com/store/{game_slug}/products/{category_slug}/"
        url = base if page == 1 else f"{base}?page={page}"
        html = fetch(url)
        page_products = parse_category_page(html, game_slug, category_slug)
        new_products = [p for p in page_products if p["product_url"] not in seen_urls]
        if not new_products:
            break
        for p in new_products:
            seen_urls.add(p["product_url"])
        products.extend(new_products)
        if len(page_products) < PAGE_SIZE:
            break
        page += 1
        time.sleep(0.4)
    return products


def main():
    all_products = []
    errors = []
    for game_slug, categories in GAMES.items():
        for category_slug in categories:
            try:
                products = fetch_category_all_pages(game_slug, category_slug)
            except Exception as e:
                errors.append({"url": f"{game_slug}/{category_slug}", "error": str(e)})
                print(f"ERROR  {game_slug}/{category_slug}: {e}")
                continue
            print(f"{game_slug:28s} {category_slug:20s} -> {len(products)} products")
            all_products.extend(products)
            time.sleep(0.4)  # be polite

    OUT.write_text(json.dumps({"products": all_products, "errors": errors}, indent=2))
    print(f"\nTotal products: {len(all_products)}")
    print(f"Errors: {len(errors)}")
    print(f"Written to {OUT}")


if __name__ == "__main__":
    main()
