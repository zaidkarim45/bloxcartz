# Phase 0 Extraction Notes — bloxcart.com

Captured 2026-08-28 via live DOM/network inspection (headless browser), not screenshots. Supplements `design-tokens.json`. Replaces "best guess" items in `BLOXCART_SHOPIFY_REBUILD_SPEC.md`.

## 🔴 Critical finding: the current site already runs on Shopify Plus

- Product images load from `cdn.shopify.com/s/files/1/0815/2068/9482/...` (34 of 41 images on a category page).
- The live `/guarantee` page states outright: *"As a Shopify Plus merchant, every transaction runs through hosted, PCI-compliant checkout infrastructure"* and *"Payments are processed by Stripe"* (likely Shopify Payments/Stripe combo, or Stripe via Shopify).
- Custom domain paths (`/store/{game}/products/{category}/`) are a **Next.js frontend calling the Shopify Storefront/Admin API headlessly** — not a from-scratch custom store.

**Implication:** this project is very likely a **frontend-only rebuild** — replacing the custom Next.js storefront with a native Online Store 2.0 theme *on the same existing Shopify Plus store*, not a from-scratch data migration. Spec's Phase 8 ("import/re-enter all products") is probably unnecessary if we connect to the existing store — the catalog, collections, pricing, and inventory likely already live there.

**This needs Yousif's confirmation before Phase 2** (theme scaffold), because connecting Shopify's GitHub integration requires knowing *which* Shopify store (the `*.myshopify.com` handle) and having Admin access to it.

## 🔴 Second finding: the site is fully localized into 11 languages, not just a static selector

Sitemap (`/sitemap.xml` → `static.xml`) lists every static page and every game/category page mirrored under `/es`, `/fr`, `/de`, `/pt-br`, `/ar`, `/it`, `/ja`, `/nl`, `/pl`, `/zh`, plus `hreflang` alternates in `<head>`. This is real, working i18n routing, not a decorative "English / CAD" label as the spec assumed. Replicating this in Shopify means Shopify Markets + Translate & Adapt (or equivalent) across 11 locales — a materially larger scope item than the spec accounted for. **Needs a scope decision from Yousif**: replicate all 11 languages at launch, or ship English-only first and backfill translations later?

## Confirmed design tokens

See `design-tokens.json`. Highlights vs. the spec's guesses:
- Background `#131C23`, cards `#18222A` (spec guessed close but not exact).
- Accent purple is `#B556F3` (buttons use a slightly darker `#9D41D9`) — not a gradient on the small "Add" buttons; the big hero CTA does appear to use a gradient + drop-shadow "3D" style, so there are two distinct button treatments, not one.
- Fonts are **not** a single family. Confirmed self-hosted (next/font): **Geist** (body/headings), **Poppins** (header nav), **Plus Jakarta Sans** (hero CTA), and **Outfit** (fully loaded, location not yet pinned down — check during build).
- Price strikethrough is **not** CSS `text-decoration: line-through` — it's a separate red diagonal line div overlaid on grey text at a ‑12° rotation. Worth replicating exactly since it's a distinctive visual signature.
- Rarity accent-bar colors confirmed for MM2 only (Godly `#E7592C`, Ancient `#C46CFF`, Unique `#FE5050`); other games use entirely different rarity vocabularies — see table below.

## Third-party scripts / pixels confirmed (for QA checklist item + Phase 4 header/footer build)

- **Chat widget:** Crisp (`client.crisp.chat`) — not Tidio/Tawk.to as spec guessed.
- **Cookie consent / CMP:** Termly (`app.termly.io/resource-blocker`), wired to Google Consent Mode v2 (default-denied, updates on accept).
- **Google Ads / GA4:** `gtag` for `AW-16686151732`, plus a **server-side GTM proxy** at `bloxcart.com/cvg/*` (their own domain, "Converge" naming) forwarding to GA4 property `G-RKB0353F5E`.
- **TikTok Pixel:** confirmed loaded (`analytics.tiktok.com`, sdkid `CP5I8TRC77U6AE4R5F8G`).
- **PostHog:** confirmed via reverse-proxied ingest at `bloxcart.com/ingest/e/` (posthog-js ~v1.359.1) — not mentioned in spec at all.
- **Klaviyo:** email marketing tracking script loaded.
- **No Meta/Facebook Pixel detected** — spec assumed one existed for Meta ad campaigns; not found in 2 separate checks. Confirm with Yousif whether Meta ads are actually running and the pixel is missing, or whether Meta isn't currently in the media mix.
- **Sentry:** error tracking present (trace headers in `<head>`), no user-facing impact.

## Site map / routing — confirmed exact and matches spec

`/store/{game}/products/{category}/` and `/{game}/products/{category}/{slug}-{id}` patterns confirmed live, e.g.:
`https://bloxcart.com/murder-mystery-2/products/guns/new-gingerscope-gun-p34g2bk3ey`

Additional route not in spec: **`/support`** — renders the identical "FAQ & Support" page as `/faq` (same content, dual route).

## Per-game category/tab structure (all 9 games crawled)

| Game | Tabs (with counts at capture time) | Rarity tiers (with counts) |
|---|---|---|
| Murder Mystery 2 | All items (44), Best Sellers (29), Bundles (1), Guns (20), Knives (20), Summer Specials (3) | Godly (35), Ancient (8), Unique (1) |
| Steal a Brainrot | All items (115), Best Sellers (7), Brainrots (106), Gamepasses (6), Money (3) | Common (9), secret (103), og (3) |
| Blox Fruits | All items (55), Best Sellers (10), Gamepass (15), Permanent Fruits (40) | Legendary (9), Rare (5), Uncommon (6), Common (23), mythical (12) |
| Pet Simulator 99 | All items (11), Best Sellers (2), Gargantuans (2), Gems (4), Titanics (5) | Common (4), exclusive (7) |
| Blade Ball | All items (7), Best Sellers (1), Tokens (7) | Common (7) |
| Grow a Garden 2 | All items (47), Best Sellers (35), Gears (13), Pets (19), Seeds (15) | Legendary (2), mythic (18), super (27) |
| 99 Nights in the Forest | All items (4), Best Sellers (4), Diamonds (4) | Common (4) |
| Dress to Impress | All items (13), Best Sellers (13), Gamepasses (13) | Rare (13) |
| Adopt Me | **External affiliate only** — confirmed link is `https://neonpets.com/discount/CART?utm_source=bloxcart&utm_medium=referral`, no internal `/store/adopt-me/` page exists | n/a |

**Data-model implication:** rarity is *not* a fixed global enum — each game has its own vocabulary, casing is inconsistent even within a game (e.g. Blox Fruits mixes "Legendary" and "mythical"), and some games (Blade Ball, 99 Nights) only have a single rarity value that provides no real filtering value. Confirms spec's recommendation to model rarity as a free-text tag per product rather than a structured metafield enum — but the Shopify product import should also normalize/clean casing while at it, worth flagging to Yousif as a data-quality opportunity during migration.

## Product detail page (not previously captured — now confirmed)

Layout: breadcrumb → rarity badge + "🔥 Bestseller" badge (conditional) → title → price row (current, strikethrough, "-X% OFF" pill) → short description paragraph → stock status line → **two CTA buttons side by side**: "Add to cart" (purple) and "Buy it now" (green, glowing — not in original spec) → payment-method icon row (Amex, Apple Pay, Diners, Discover, Mastercard, Visa) → "Secure checkout with 256-bit encryption" note → "Similar items" grid below.

After "Add to cart" is clicked, the button morphs in place into a quantity stepper (trash/remove icon, count, + icon) — no separate quantity input beforehand.

## Cart drawer (not previously captured)

Slides in from the right over a dark backdrop on clicking the header cart pill. Contains: header with item count + "Clear cart" + close, one row per line item (thumbnail, rarity+name, price w/ strikethrough, qty stepper, line total), promo code input + Apply button, subtotal, bold total, full-width purple "Checkout $X" button at the bottom. This maps directly to Shopify's native Ajax Cart API + a custom cart-drawer section — no surprises here, just confirms it's buildable natively.

## Static pages confirmed

- `/claim` — simple form: "Order number or reference" + "Checkout email" → "Continue to claim". Confirms spec's guess (order lookup/redelivery), not a mystery flow — trivial to rebuild as a custom Shopify page/app-proxy form once we know what claim actually does on submit (still need to see the success/redelivery state — did not have a real order to test with).
- `/faq` (and `/support`, same content) — FAQ organized into 3 categories: "Orders and Checkout", "Getting Your Items", "Safety and Refunds", 9 questions total, plus a CTA to `/tutorials`.
- `/install` — PWA "Add to Home Screen" instructions page (iPhone/Safari, Android/Chrome, Desktop/Chrome-Edge tabs). **Flag for Yousif:** Shopify Online Store 2.0 themes don't natively support installable PWA (custom manifest + service worker) the way a Next.js app does — we can ship a basic web-app manifest for icon/splash purposes, but "opens already signed in, full offline shell" parity isn't achievable in stock Shopify without a paid PWA app. Needs a scope call.
- `/guarantee` — confirms Stripe/Shopify Plus checkout language (see critical finding above), delivery stats (median 2m14s, 81% within 5min, 96% within 30min), automatic 48-hour refund policy copy.
- Legal disclaimer footer text confirmed **verbatim identical** to spec's quoted paragraph — reuse as-is.
- Stock-warning banner copy on MM2 confirmed **verbatim identical** to spec's quoted text, styled as an amber/warning alert box (~4% bg opacity, 32% border opacity, 14px radius).

## Still open (not yet checked — flagging rather than guessing)

- Outfit font's actual usage location.
- Exact rarity accent-bar colors for the other 8 games (only sampled MM2's three).
- `/tutorials` and `/blog` content depth (titles/structure only, not fully read).
- `/claim` success-state UI (no real order available to submit).
- Bundle purchase model (single SKU vs. grouped) — only saw 1 bundle exists for MM2, didn't open it.
- Exact breakpoint values (only spot-checked 375px and 1280px).
