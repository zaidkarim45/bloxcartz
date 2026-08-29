#!/usr/bin/env python3
"""
Quality-control pass over data/catalog.json and the downloaded/processed
assets. Prints a report and writes data/_qc_report.json. Run after
download_images.py, process_images.py, and resolve_rarity.py.
"""
import json
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"

KNOWN_GAMES = {
    "murder-mystery-2",
    "steal-a-brainrot",
    "blox-fruits",
    "pet-simulator-99",
    "blade-ball",
    "grow-a-garden-2",
    "99-nights-in-the-forest",
    "dress-to-impress",
}


def main():
    catalog = json.loads(CATALOG.read_text())
    report = {}

    # Every product has name/game/handle
    missing_core = [p["shopify_handle"] for p in catalog if not (p["product_name"] and p["game"] and p["shopify_handle"])]
    report["missing_core_fields"] = missing_core

    # Duplicate handles
    handle_counts = Counter(p["shopify_handle"] for p in catalog)
    report["duplicate_handles"] = {h: c for h, c in handle_counts.items() if c > 1}

    # Unknown game slugs
    report["unknown_game_slugs"] = sorted({p["game_slug"] for p in catalog} - KNOWN_GAMES)

    # Missing raw / processed assets
    missing_raw = [p["shopify_handle"] for p in catalog if not p.get("raw_asset_path") or not (ROOT / p["raw_asset_path"]).exists()]
    missing_processed = [
        p["shopify_handle"]
        for p in catalog
        if not p.get("processed_png_path") or not (ROOT / p["processed_png_path"]).exists()
    ]
    report["missing_raw_assets"] = missing_raw
    report["missing_processed_assets"] = missing_processed

    # Duplicate filenames within raw/ (would indicate a naming collision, not just a shared source image)
    raw_paths = [p.get("raw_asset_path") for p in catalog if p.get("raw_asset_path")]
    raw_name_counts = Counter(Path(rp).name for rp in raw_paths)
    report["duplicate_raw_filenames"] = {n: c for n, c in raw_name_counts.items() if c > 1}

    # Shared source images across different products (not an error, just informational)
    by_source_image = defaultdict(list)
    for p in catalog:
        if p["source_image_url"]:
            by_source_image[p["source_image_url"]].append(p["shopify_handle"])
    shared_images = {url: handles for url, handles in by_source_image.items() if len(handles) > 1}
    report["products_sharing_one_source_image"] = shared_images

    # Broken image files (fail to open)
    broken = []
    try:
        from PIL import Image

        for p in catalog:
            for key in ("raw_asset_path", "processed_png_path"):
                path = p.get(key)
                if path and (ROOT / path).exists():
                    try:
                        img = Image.open(ROOT / path)
                        img.verify()
                    except Exception as e:
                        broken.append({"handle": p["shopify_handle"], "path": path, "error": str(e)})
    except ImportError:
        report["broken_images_check"] = "SKIPPED (Pillow not installed)"
    report["broken_images"] = broken

    # Rarity coverage
    total = len(catalog)
    unambiguous = sum(1 for p in catalog if p.get("rarity_name") and not p.get("rarity_ambiguous"))
    ambiguous = sum(1 for p in catalog if p.get("rarity_ambiguous"))
    report["rarity_coverage"] = {"total": total, "unambiguous": unambiguous, "ambiguous": ambiguous}

    # Category / game distribution
    report["products_by_game"] = dict(Counter(p["game"] for p in catalog))
    report["products_by_category"] = dict(Counter(f"{p['game_slug']}/{p['category']}" for p in catalog))

    # Availability
    report["availability"] = dict(Counter(p.get("available") for p in catalog))

    (ROOT / "data" / "_qc_report.json").write_text(json.dumps(report, indent=2))

    # Print human-readable summary
    print("=== QC SUMMARY ===")
    print(f"Total products: {total}")
    print(f"Missing core fields: {len(missing_core)}")
    print(f"Duplicate handles: {len(report['duplicate_handles'])}")
    print(f"Unknown game slugs: {report['unknown_game_slugs']}")
    print(f"Missing raw assets: {len(missing_raw)}")
    print(f"Missing processed assets: {len(missing_processed)}")
    print(f"Duplicate raw filenames: {len(report['duplicate_raw_filenames'])}")
    print(f"Products sharing a source image with another product: {sum(len(v) for v in shared_images.values())} across {len(shared_images)} images")
    print(f"Broken image files: {len(broken)}")
    print(f"Rarity: {unambiguous}/{total} unambiguous, {ambiguous}/{total} ambiguous")
    print(f"Availability: {report['availability']}")


if __name__ == "__main__":
    main()
