#!/usr/bin/env python3
"""
Downloads the actual per-game marketing artwork (card thumbnail + small
icon) as used live on bloxcart.com's home page / header game selector.
These are hosted on media.bloxcart.com (a Payload CMS media bucket —
separate from the Shopify-hosted product catalog images), confirmed by
inspecting the homepage's <link rel=preload> tags.

Adopt Me is included here (game *artwork* exists) even though it has no
internal product catalog — confirmed external NeonPets affiliate link only.
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "catalog" / "games"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

GAMES = {
    "murder-mystery-2": {
        "thumbnail": "https://media.bloxcart.com/payload-media/murder-mystery-2-thumbnail.webp",
        "icon": "https://media.bloxcart.com/payload-media/murder-mystery-2-icon.webp",
    },
    "steal-a-brainrot": {
        "thumbnail": "https://media.bloxcart.com/payload-media/steal-a-brainrot-thumbnail.webp",
        "icon": "https://media.bloxcart.com/payload-media/steal-a-brainrot-icon.webp",
    },
    "blox-fruits": {
        "thumbnail": "https://media.bloxcart.com/payload-media/blox-fruits-thumbnail.webp",
        "icon": "https://media.bloxcart.com/payload-media/blox-fruits-icon.webp",
    },
    "adopt-me": {
        "thumbnail": "https://media.bloxcart.com/payload-media/adopt-me-thumbnail.png",
        "icon": "https://media.bloxcart.com/payload-media/adopt-me-icon-1.webp",
    },
    "pet-simulator-99": {
        "thumbnail": "https://media.bloxcart.com/payload-media/pet-simulator-99-thumbnail-1.webp",
        "icon": "https://media.bloxcart.com/payload-media/pet-simulator-99-icon-1.webp",
    },
    "blade-ball": {
        "thumbnail": "https://media.bloxcart.com/payload-media/blade-ball-thumbnail.png",
        "icon": "https://media.bloxcart.com/payload-media/blade-ball-icon.webp",
    },
    "grow-a-garden-2": {
        "thumbnail": "https://media.bloxcart.com/payload-media/grow-a-garden-2-thumbnail.webp",
        "icon": "https://media.bloxcart.com/payload-media/grow-a-garden-2-icon.webp",
    },
    "99-nights-in-the-forest": {
        "thumbnail": "https://media.bloxcart.com/payload-media/99-nights-in-the-forest-thumbnail.png",
        "icon": "https://media.bloxcart.com/payload-media/99-nights-in-the-forest-icon.webp",
    },
    "dress-to-impress": {
        "thumbnail": "https://media.bloxcart.com/payload-media/dress-to-impress-thumbnail.webp",
        "icon": "https://media.bloxcart.com/payload-media/dress-to-impress-icon.webp",
    },
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for game_slug, assets in GAMES.items():
        for kind, url in assets.items():
            ext = url.rsplit(".", 1)[-1]
            out_path = OUT_DIR / f"{game_slug}-{kind}.{ext}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                out_path.write_bytes(data)
                results.append(
                    {
                        "game_slug": game_slug,
                        "kind": kind,
                        "source_url": url,
                        "local_path": str(out_path.relative_to(ROOT)),
                        "size_bytes": len(data),
                        "status": "ok",
                    }
                )
                print(f"OK   {game_slug:28s} {kind:10s} {len(data)/1024:.0f} KB")
            except Exception as e:
                results.append(
                    {"game_slug": game_slug, "kind": kind, "source_url": url, "status": "failed", "error": str(e)}
                )
                print(f"FAIL {game_slug:28s} {kind:10s} {e}")

    (ROOT / "data" / "game_images.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
