# BloxCart Shopify theme rebuild

Rebuild of bloxcart.com as a Shopify Online Store 2.0 theme. See
`BLOXCART_SHOPIFY_REBUILD_SPEC.md` (original spec, not in this repo — kept
alongside it) and `PHASE_0_EXTRACTION_NOTES.md` / `design-tokens.json` for
everything confirmed by inspecting the live site before any code was written.

## Status

- **Phase 0 (extraction):** done. Real computed styles, fonts, third-party
  scripts, full 9-game category/tab crawl — see `PHASE_0_EXTRACTION_NOTES.md`.
- **Phase 2 (theme scaffold):** done locally — full Online Store 2.0 folder
  structure, hand-authored (Shopify CLI isn't installed on this machine and
  wasn't needed for scaffolding). **Not yet connected to a live store** —
  see "What I need from you" below.
- **Phase 3 (design system):** done — `assets/fonts.css`, `base.css`,
  `components.css` implement the confirmed tokens (colors, the two button
  styles, the non-standard diagonal-line price strikethrough, rarity accent
  bars, pill tabs).
- **Phase 4 (global sections):** done — `sections/header.liquid`,
  `footer.liquid`, `snippets/cart-drawer.liquid`,
  `snippets/third-party-scripts.liquid` (Crisp, Termly/Consent Mode v2,
  Google Ads/GA4, TikTok Pixel, PostHog, Klaviyo — all gated behind Theme
  Settings so IDs can be swapped without a code deploy).
- **Phase 5 (home page):** done — hero, game grid, how-it-works, trust
  section, wired up in `templates/index.json` with the real 9-game list
  (Adopt Me as the confirmed external NeonPets link).
- **Phase 6 (collection/game template):** done — `sections/main-collection.liquid`
  implements the pill tab bar, price/availability/rarity filters, search,
  sort, and product grid using Shopify's native filtering
  (`collection.filters`, tag-based `/collections/{handle}/{tag}` routing) —
  requires the **Search & Discovery** app installed and configured on the
  real store to show real counts.
- **Phase 7 (product template):** done — `sections/main-product.liquid`,
  including the "Buy it now" button implemented as Shopify's native
  `payment_button` (dynamic checkout), not a hand-rolled second button.
- **Phase 9 (static pages):** done for Claim, Contact (native Shopify
  contact form), FAQ, Guarantee, Install (with a PWA-parity caveat), Blog,
  generic pages. **Legal pages (Terms/Privacy/Cookie/Refund) intentionally
  use Shopify's native Policy pages** (`Settings → Policies` in Admin, routed
  at `/policies/...`) instead of custom templates — paste the confirmed
  verbatim copy there. That's a URL change from the spec's `/terms-of-service`
  etc., which Phase 10 redirects need to account for.
- **Phase 1 (deployment strategy) / Phase 8 (data import):** not started —
  both depend on the store decision below.
- **Phase 10 (redirects) and Phase 12 (cutover):** intentionally not started —
  you asked me to stop before these.

## What I need from you before this can go further

1. **A Shopify store to connect to.** You chose "build fresh" over reusing
   bloxcart.com's existing Shopify Plus backend, so this needs an actual new
   store. I can't create a Shopify account/store myself (that's account
   creation, which I don't do on your behalf) — please either:
   - Create a free Shopify Partner account + development store yourself
     (partners.shopify.com → Stores → Add store → Development store), or
   - Give an existing store's Admin access if you already have one in mind.

   Once it exists: **Admin → Online Store → Themes → Add theme → Connect
   from GitHub**, pointing at this repo (`zaidkarim45/bloxcartz`).
2. **Install the Search & Discovery app** on that store (free, by Shopify) —
   `sections/main-collection.liquid` is written against its
   `collection.filters` API for price/availability/rarity filtering.
3. Answers to the spec's remaining open questions (still unresolved):
   - Bundle purchase model — single SKU or grouped products? (only 1 bundle
     exists on MM2 currently, wasn't opened during Phase 0)
   - `/claim` — what should actually happen on submit? UI is built
     (`sections/claim-order.liquid`) but not wired to real order lookup.
   - Blog/Tutorials content depth — only page titles were confirmed, not
     full content.
   - Exact per-game accent-bar/gradient colors for the 7 games beyond MM2 —
     `templates/index.json` currently uses reasonable placeholder gradients
     per game, not sampled hex values.

## Local dev environment note

Node.js, npm, and Shopify CLI are **not installed** on this machine. They're
needed for `shopify theme dev` (live preview against a real store) and
`shopify theme push`, but not for anything done so far. Once a store exists,
let me know and I'll set up Node/Shopify CLI to continue.

## Content ownership

Nearly all copy (hero, trust badges, FAQ questions, guarantee stats, install
instructions, IP disclaimer) is wired through `settings_schema.json` and
section schema `settings`/`blocks`, not hardcoded — so it's editable in the
theme editor without a code deploy, and easy to correct against the live
site's actual current copy if it's changed since Phase 0.
