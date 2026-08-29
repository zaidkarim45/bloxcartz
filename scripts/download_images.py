#!/usr/bin/env python3
"""
Downloads the full-resolution original product image for every entry in
data/catalog.json directly from bloxcart.com's own Shopify CDN (the
`source_image_url` field — never a Next.js-resized/proxied copy) into
assets/catalog/raw/{game_slug}/{category}/{shopify_handle}.{ext}

Idempotent: skips files that already exist on disk unless --force is passed.
"""
import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
RAW_DIR = ROOT / "assets" / "catalog" / "raw"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="re-download even if file exists")
    args = parser.parse_args()

    catalog = json.loads(CATALOG.read_text())
    ok, skipped, failed = [], [], []

    for i, p in enumerate(catalog, 1):
        url = p["source_image_url"]
        fn = p["source_image_filename"]
        if not url or not fn:
            failed.append({"handle": p["shopify_handle"], "reason": "no source image url"})
            continue
        ext = fn.rsplit(".", 1)[-1].lower() if "." in fn else "png"
        out_dir = RAW_DIR / p["game_slug"] / p["category"]
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{p['shopify_handle']}.{ext}"

        p["raw_asset_path"] = str(out_path.relative_to(ROOT))

        if out_path.exists() and not args.force:
            skipped.append(p["shopify_handle"])
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                out_path.write_bytes(resp.read())
            size = out_path.stat().st_size
            if size < 500:
                failed.append({"handle": p["shopify_handle"], "reason": f"suspiciously small ({size} bytes)"})
                out_path.unlink()
            else:
                ok.append(p["shopify_handle"])
        except Exception as e:
            failed.append({"handle": p["shopify_handle"], "reason": str(e)})

        if i % 25 == 0:
            print(f"  ...{i}/{len(catalog)}")
        time.sleep(0.15)

    CATALOG.write_text(json.dumps(catalog, indent=2))

    print(f"\nDownloaded: {len(ok)}")
    print(f"Already present (skipped): {len(skipped)}")
    print(f"Failed: {len(failed)}")
    for f in failed:
        print("  FAILED:", f["handle"], "-", f["reason"])

    report = {"downloaded": ok, "skipped": skipped, "failed": failed}
    (ROOT / "data" / "_download_report.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
