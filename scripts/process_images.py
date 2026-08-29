#!/usr/bin/env python3
"""
Normalizes raw catalog images for consistent product-card presentation
(Step 6 of the migration request) without redesigning the artwork:

1. Autocrop to the alpha-channel content bounding box (strip excess
   transparent padding baked into the source file).
2. Scale so the content's LONGEST edge occupies a fixed fraction of a
   fixed-size square canvas — this is what keeps a long thin gun and a
   round compact pet visually consistent in a grid, instead of one
   overflowing its card and the other looking tiny. Aspect ratio is
   always preserved; nothing is stretched.
3. Center on a transparent square canvas.
4. Write both a PNG (transparency-preserving) and a WebP (smaller,
   storefront-optimized) copy.

Source images already ship with real alpha transparency (confirmed by
inspection — not solid-background photos), so no background removal is
attempted here; that would risk cutting into the actual artwork for a
problem that doesn't exist in this catalog.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"
PROCESSED_DIR = ROOT / "assets" / "catalog" / "processed"

CANVAS_SIZE = 1024
CONTENT_OCCUPANCY = 0.82  # longest content edge fills this fraction of canvas
ALPHA_THRESHOLD = 8  # pixels with alpha <= this are considered "empty" for bbox purposes


def autocrop_bbox(img: Image.Image):
    alpha = img.split()[-1]
    # Threshold alpha so near-zero (but not exactly zero, e.g. anti-aliased
    # edges) doesn't inflate the bounding box.
    mask = alpha.point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()
    return bbox


def process_one(src_path: Path, dst_png: Path, dst_webp: Path):
    img = Image.open(src_path).convert("RGBA")
    bbox = autocrop_bbox(img)
    if bbox is None:
        # Fully transparent image — nothing to crop, flag by returning False.
        return False, "fully transparent, no content found"

    content = img.crop(bbox)
    w, h = content.size
    longest = max(w, h)
    target_longest = CANVAS_SIZE * CONTENT_OCCUPANCY
    scale = target_longest / longest
    new_w, new_h = round(w * scale), round(h * scale)
    resized = content.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    paste_x = (CANVAS_SIZE - new_w) // 2
    paste_y = (CANVAS_SIZE - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)

    dst_png.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst_png, "PNG", optimize=True)
    canvas.save(dst_webp, "WEBP", quality=90, method=6)
    return True, None


def main():
    catalog = json.loads(CATALOG.read_text())
    ok, failed = [], []

    for i, p in enumerate(catalog, 1):
        raw_path = ROOT / p["raw_asset_path"]
        if not raw_path.exists():
            failed.append({"handle": p["shopify_handle"], "reason": "raw file missing"})
            continue

        out_dir = PROCESSED_DIR / p["game_slug"] / p["category"]
        dst_png = out_dir / f"{p['shopify_handle']}.png"
        dst_webp = out_dir / f"{p['shopify_handle']}.webp"

        try:
            success, reason = process_one(raw_path, dst_png, dst_webp)
            if success:
                ok.append(p["shopify_handle"])
                p["processed_png_path"] = str(dst_png.relative_to(ROOT))
                p["processed_webp_path"] = str(dst_webp.relative_to(ROOT))
            else:
                failed.append({"handle": p["shopify_handle"], "reason": reason})
        except Exception as e:
            failed.append({"handle": p["shopify_handle"], "reason": str(e)})

        if i % 50 == 0:
            print(f"  ...{i}/{len(catalog)}")

    CATALOG.write_text(json.dumps(catalog, indent=2))

    print(f"\nProcessed: {len(ok)}")
    print(f"Failed: {len(failed)}")
    for f in failed:
        print("  FAILED:", f["handle"], "-", f["reason"])


if __name__ == "__main__":
    main()
