#!/usr/bin/env python3
"""
Resolves each product's rarity_accent_color back to a rarity NAME using
each game's filter-sidebar color legend (collected once per game by
inspecting the live rarity checkboxes' SVG fill color — same technique
used in Phase 0 for Murder Mystery 2, extended here to all 8 games with
an internal catalog).

Several games reuse the identical accent color for two different rarity
tiers (e.g. Steal a Brainrot's "secret" and "og" are both #C0C0C0) — in
those cases the name CANNOT be reliably inferred from color alone, so
per the "don't invent missing information" rule, affected products are
left with rarity_name=null and rarity_ambiguous=true instead of guessing.
"""
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "catalog.json"

# [rarity_name, hex_color] pairs, collected live per game (see
# PHASE_0_EXTRACTION_NOTES.md for MM2; the other 7 collected in this session
# via the same `label[id^="rarity-"] svg path[fill]` technique).
RARITY_LEGEND = {
    "murder-mystery-2": {"godly": "#E7592C", "ancient": "#C46CFF", "unique": "#FE5050"},
    "steal-a-brainrot": {"common": "#DCDCF9", "secret": "#C0C0C0", "og": "#C0C0C0"},
    "blox-fruits": {
        "legendary": "#68D74D",
        "rare": "#4891FF",
        "uncommon": "#DCDCF9",
        "common": "#DCDCF9",
        "mythical": "#C0C0C0",
    },
    "pet-simulator-99": {"common": "#DCDCF9", "exclusive": "#C0C0C0"},
    "blade-ball": {"common": "#DCDCF9"},
    "grow-a-garden-2": {"legendary": "#68D74D", "mythic": "#C0C0C0", "super": "#C0C0C0"},
    "99-nights-in-the-forest": {"common": "#DCDCF9"},
    "dress-to-impress": {"rare": "#4891FF"},
}


def main():
    catalog = json.loads(CATALOG.read_text())

    # Build color -> [names] per game so we can detect collisions.
    color_to_names = {}
    for game_slug, legend in RARITY_LEGEND.items():
        rev = defaultdict(list)
        for name, color in legend.items():
            rev[color.upper()].append(name)
        color_to_names[game_slug] = rev

    resolved, ambiguous, unmatched = 0, 0, 0
    for p in catalog:
        game_slug = p["game_slug"]
        color = (p.get("rarity_accent_color") or "").upper()
        names = color_to_names.get(game_slug, {}).get(color, [])
        if len(names) == 1:
            p["rarity_name"] = names[0]
            p["rarity_ambiguous"] = False
            resolved += 1
        elif len(names) > 1:
            p["rarity_name"] = None
            p["rarity_ambiguous"] = True
            p["rarity_ambiguous_candidates"] = names
            ambiguous += 1
        else:
            p["rarity_name"] = None
            p["rarity_ambiguous"] = False
            unmatched += 1

    CATALOG.write_text(json.dumps(catalog, indent=2))
    print(f"Resolved unambiguously: {resolved}")
    print(f"Ambiguous (color shared by 2+ rarity names in that game): {ambiguous}")
    print(f"Unmatched (color not in legend at all): {unmatched}")


if __name__ == "__main__":
    main()
