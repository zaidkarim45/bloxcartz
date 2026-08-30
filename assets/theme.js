(function () {
  "use strict";

  /* ---- Header: game select dropdown ---- */
  document.querySelectorAll("[data-game-select]").forEach(function (root) {
    var btn = root.querySelector(".site-header__game-select-btn");
    var menu = root.querySelector(".site-header__game-menu");
    if (!btn || !menu) return;

    // Uses opacity/transform (not the `hidden` attribute) for open/close
    // so the CSS transition can actually animate it.
    menu.hidden = false;

    function closeMenu() {
      btn.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
    }
    function openMenu() {
      btn.setAttribute("aria-expanded", "true");
      menu.classList.add("is-open");
      var search = menu.querySelector("[data-game-search]");
      if (search) search.focus();
    }

    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      if (open) closeMenu(); else openMenu();
    });
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    var search = menu.querySelector("[data-game-search]");
    var items = menu.querySelectorAll(".site-header__game-list li");
    var empty = menu.querySelector(".site-header__game-empty");
    if (search) {
      search.addEventListener("click", function (e) { e.stopPropagation(); });
      search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase();
        var anyVisible = false;
        items.forEach(function (li) {
          var match = (li.getAttribute("data-game-name") || "").indexOf(q) !== -1;
          li.hidden = !match;
          if (match) anyVisible = true;
        });
        if (empty) empty.hidden = anyVisible;
      });
    }
  });

  /* ---- Header: mobile menu toggle ---- */
  var menuToggle = document.querySelector("[data-mobile-menu-toggle]");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      var open = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!open));
      document.body.classList.toggle("mobile-menu-open", !open);
    });
  }

  /* ---- Cart drawer ---- */
  var drawer = document.querySelector("[data-cart-drawer]");

  function openCartDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    requestAnimationFrame(function () {
      drawer.classList.add("is-open");
    });
    document.body.classList.add("cart-drawer-open");
  }

  function closeCartDrawer() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    document.body.classList.remove("cart-drawer-open");
    window.setTimeout(function () {
      drawer.hidden = true;
    }, 200);
  }

  document.querySelectorAll("[data-cart-toggle]").forEach(function (el) {
    el.addEventListener("click", openCartDrawer);
  });
  document.querySelectorAll("[data-cart-close]").forEach(function (el) {
    el.addEventListener("click", closeCartDrawer);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeCartDrawer();
  });

  /* ---- Cart mutations (Shopify Ajax Cart API) ----
     Every mutation asks Shopify to re-render sections/cart-drawer.liquid
     server-side (the `sections` param on cart/add.js, cart/change.js,
     cart/update.js and cart/clear.js) and swaps that HTML wholesale into
     `.cart-drawer__panel`. Subtotal/discount/total in that markup always
     come straight from Liquid's `money` filter against the real `cart`
     object, so there is no client-side cents arithmetic left anywhere in
     this flow -- the old `$NaN` bug had no code path left to occur from.
     Click/submit handlers below are delegated on `document` (rather than
     bound to specific nodes) precisely because this innerHTML swap
     replaces every element inside the panel on each update. */

  function shopifyRoot() {
    return (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
  }

  function cartSectionUrl() {
    return shopifyRoot().replace(/\/$/, "") + "/?section_id=cart-drawer";
  }

  function cartRequest(endpoint, body) {
    return fetch(shopifyRoot() + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (err) { throw err; });
      return r.json();
    });
  }

  // Swaps freshly-rendered section markup into the live drawer, then syncs
  // the header's cart pill from that same markup -- copying its already
  // Liquid-rendered count/`money` text rather than recomputing either
  // client-side, so the header pill can't drift into $NaN or a stale count.
  // (The `cart` argument is only ever used as a fallback for item count,
  // since not every caller has a full cart object handy.)
  function applyCartUpdate(cart, sectionHtml) {
    if (!drawer || !sectionHtml) return;
    var panel = drawer.querySelector(".cart-drawer__panel");
    var doc = new DOMParser().parseFromString(sectionHtml, "text/html");
    var newPanel = doc.querySelector(".cart-drawer__panel");
    if (!panel || !newPanel) return;
    panel.innerHTML = newPanel.innerHTML;

    var freshCount = panel.querySelector(".cart-drawer__count");
    var itemCount = freshCount
      ? parseInt(freshCount.textContent, 10) || 0
      : (cart && typeof cart.item_count === "number" ? cart.item_count : 0);
    document.querySelectorAll(".site-header [data-cart-count]").forEach(function (el) {
      el.textContent = itemCount;
      el.hidden = itemCount === 0;
    });
    var freshTotal = panel.querySelector("[data-cart-total]");
    if (freshTotal) {
      document.querySelectorAll(".site-header [data-cart-total]").forEach(function (el) {
        el.textContent = freshTotal.textContent;
      });
    }
  }

  function refreshCartSection() {
    return fetch(cartSectionUrl(), { headers: { Accept: "text/html" } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        return fetch(shopifyRoot() + "cart.js").then(function (r) { return r.json(); }).then(function (cart) {
          applyCartUpdate(cart, html);
          return cart;
        });
      });
  }

  function changeLineQuantity(key, quantity) {
    return cartRequest("cart/change.js", { id: key, quantity: quantity, sections: "cart-drawer" }).then(function (cart) {
      applyCartUpdate(cart, cart.sections && cart.sections["cart-drawer"]);
      return cart;
    });
  }

  function clearCart() {
    return cartRequest("cart/clear.js", { sections: "cart-drawer" }).then(function (cart) {
      applyCartUpdate(cart, cart.sections && cart.sections["cart-drawer"]);
      return cart;
    });
  }

  // Shopify's Ajax Cart API has no dedicated "validate this discount code"
  // endpoint -- /discount/{code} is the only storefront route that applies
  // one, and it's a redirect responder rather than JSON. Fetching it
  // (fetch follows the redirect internally, so the browser never
  // navigates) applies the code to the cart's checkout session if it's
  // valid and silently no-ops if it isn't; a follow-up cart/update.js call
  // re-renders the section and hands back the authoritative cart object so
  // we can tell which one happened by checking whether the entered code
  // shows up in cart_level_discount_applications.
  function applyPromoCode(code) {
    var url = shopifyRoot() + "discount/" + encodeURIComponent(code) + "?redirect=" + encodeURIComponent(shopifyRoot() + "cart");
    return fetch(url, { method: "GET", redirect: "follow", credentials: "same-origin" })
      .then(function () { return cartRequest("cart/update.js", { sections: "cart-drawer" }); })
      .then(function (cart) {
        applyCartUpdate(cart, cart.sections && cart.sections["cart-drawer"]);
        var applications = cart.cart_level_discount_applications || [];
        var normalized = code.trim().toLowerCase();
        var applied = applications.some(function (d) {
          return (d.title || "").trim().toLowerCase() === normalized;
        });
        return applied;
      });
  }

  function setPromoMessage(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.classList.remove("is-success", "is-error");
    if (type) el.classList.add("is-" + type);
  }

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-promo-form]");
    if (!form) return;
    e.preventDefault();
    if (form.hasAttribute("data-pending")) return;

    var input = form.querySelector("[data-promo-input]");
    var code = input && input.value.trim();
    if (!code) return;

    form.setAttribute("data-pending", "true");
    form.classList.add("is-loading");
    form.querySelectorAll("input, button").forEach(function (el) { el.disabled = true; });

    applyPromoCode(code)
      .then(function (applied) {
        var messageEl = drawer.querySelector("[data-promo-message]");
        var freshInput = drawer.querySelector("[data-promo-input]");
        if (applied) {
          if (freshInput) freshInput.value = "";
          setPromoMessage(messageEl, messageEl && messageEl.dataset.msgSuccess, "success");
        } else {
          setPromoMessage(messageEl, messageEl && messageEl.dataset.msgInvalid, "error");
          if (freshInput) {
            freshInput.classList.add("is-error");
            window.setTimeout(function () { freshInput.classList.remove("is-error"); }, 400);
          }
        }
      })
      .catch(function () {
        var messageEl = drawer.querySelector("[data-promo-message]");
        setPromoMessage(messageEl, messageEl && messageEl.dataset.msgError, "error");
      })
      .then(function () {
        var freshForm = drawer.querySelector("[data-promo-form]");
        if (freshForm) {
          freshForm.removeAttribute("data-pending");
          freshForm.classList.remove("is-loading");
          freshForm.querySelectorAll("input, button").forEach(function (el) { el.disabled = false; });
        }
      });
  });

  document.addEventListener("click", function (e) {
    var clearBtn = e.target.closest("[data-cart-clear]");
    if (clearBtn) {
      if (clearBtn.hasAttribute("data-pending")) return;
      clearBtn.setAttribute("data-pending", "true");
      clearBtn.disabled = true;
      clearCart().catch(function () {
        clearBtn.removeAttribute("data-pending");
        clearBtn.disabled = false;
        refreshCartSection();
      });
      return;
    }

    var increaseBtn = e.target.closest("[data-qty-increase]");
    var decreaseBtn = e.target.closest("[data-qty-remove]");
    var removeBtn = e.target.closest("[data-line-remove]");
    var target = increaseBtn || decreaseBtn || removeBtn;
    if (!target) return;

    var line = target.closest("[data-cart-line]");
    if (!line || line.hasAttribute("data-pending")) return;

    var key = line.getAttribute("data-line-key");
    var qtyEl = line.querySelector("[data-qty-value]");
    var currentQty = qtyEl ? parseInt(qtyEl.textContent, 10) || 0 : 0;
    var newQty = removeBtn ? 0 : (increaseBtn ? currentQty + 1 : Math.max(currentQty - 1, 0));

    line.setAttribute("data-pending", "true");

    if (newQty === 0) {
      line.classList.add("is-removing");
      window.setTimeout(function () {
        changeLineQuantity(key, 0).catch(function () {
          line.classList.remove("is-removing");
          line.removeAttribute("data-pending");
        });
      }, 200);
      return;
    }

    line.classList.add("is-busy");
    if (qtyEl) {
      qtyEl.textContent = newQty;
      qtyEl.classList.add("is-pulsing");
      window.setTimeout(function () { qtyEl.classList.remove("is-pulsing"); }, 220);
    }
    var stepper = line.querySelector("[data-qty-stepper]");
    if (stepper) stepper.setAttribute("data-qty", newQty);

    changeLineQuantity(key, newQty).catch(function () {
      line.classList.remove("is-busy");
      line.removeAttribute("data-pending");
    });
  });

  /* ---- Collection filters + sort ---- */
  // A full page navigation (native Shopify filtering, not an SPA) can't
  // animate the incoming content, but fading the outgoing content out
  // right before it happens is enough to make switching filters/tabs
  // feel like a transition instead of an abrupt flash.
  var collectionMain = document.querySelector(".collection-page__main");
  function beginNavigating() {
    if (collectionMain) collectionMain.classList.add("is-navigating");
  }

  var filterForm = document.querySelector("[data-filter-form]");
  if (filterForm) {
    var debounceTimer;
    filterForm.addEventListener("input", function (e) {
      // The client-side-only "in stock" fallback toggle (no `name`
      // attribute -- it's not a real Shopify filter field) lives inside
      // this same form for layout reasons. Its `change` handler below
      // does the actual work by hiding/showing cards instantly; without
      // this guard, the checkbox's bubbling `input` event would also hit
      // this handler and trigger a full page reload right after, which
      // both undoes that instant toggle and silently drops the "in
      // stock" state entirely since there's no form field value for it
      // to survive the reload as.
      if (e.target.hasAttribute("data-instock-toggle")) return;

      window.clearTimeout(debounceTimer);
      // Range sliders fire native `input` events continuously while
      // dragging -- without a debounce here that means a near-continuous
      // stream of full page submissions mid-drag, which is what actually
      // made the slider feel jerky/laggy. Same idea for the price text
      // inputs: don't resubmit on every keystroke.
      var isContinuous = e.target.type === "number" || e.target.type === "range" ||
        e.target.hasAttribute("data-price-from") || e.target.hasAttribute("data-price-to");
      var delay = isContinuous ? 500 : 0;
      debounceTimer = window.setTimeout(function () {
        beginNavigating();
        filterForm.requestSubmit ? filterForm.requestSubmit() : filterForm.submit();
      }, delay);
    });
  }

  document.querySelectorAll(".pill-tab, .collection-filters__reset, .collection-section__view-all").forEach(function (el) {
    el.addEventListener("click", beginNavigating);
  });
  // The "Search items" box on a collection page has no server-side
  // consumer for `q` -- Liquid has no access to arbitrary query params on
  // a collection template, so this can't be a real filter/facet. Filtering
  // whatever product cards are already in the DOM doesn't work either:
  // the "All items" view only renders a handful of cards per category
  // (`products_per_category`), so most of the collection is never in the
  // DOM to search. Instead this fetches the collection's full product list
  // once via Shopify's public `/products.json` endpoint and renders
  // matches itself, so a search actually reaches every item.
  var collectionSearchForm = document.querySelector(".collection-page__search");
  if (collectionSearchForm) {
    var collectionSearchInput = collectionSearchForm.querySelector('input[type="search"]');
    var collectionUrl = collectionSearchForm.getAttribute("data-collection-url");
    var collectionMainEl = document.querySelector(".collection-page__main");
    collectionSearchForm.addEventListener("submit", function (e) { e.preventDefault(); });

    var productCache = null;
    var productCachePromise = null;
    function ensureProductCache() {
      if (productCache) return Promise.resolve(productCache);
      if (productCachePromise) return productCachePromise;
      productCachePromise = fetch(collectionUrl + "/products.json?limit=250")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          productCache = data.products || [];
          return productCache;
        })
        .catch(function () {
          productCachePromise = null;
          return [];
        });
      return productCachePromise;
    }

    var moneyFormatter = null;
    try {
      moneyFormatter = new Intl.NumberFormat(document.documentElement.lang || "en", {
        style: "currency",
        currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD"
      });
    } catch (e) {
      moneyFormatter = null;
    }
    function formatDollars(amount) {
      var n = parseFloat(amount);
      if (moneyFormatter) return moneyFormatter.format(n);
      return "$" + n.toFixed(2);
    }

    var resultsGrid = null;
    function getResultsGrid() {
      if (resultsGrid) return resultsGrid;
      resultsGrid = document.createElement("div");
      resultsGrid.className = "product-grid collection-page__search-results";
      resultsGrid.hidden = true;
      collectionMainEl.appendChild(resultsGrid);
      return resultsGrid;
    }

    function renderResults(products, query) {
      var grid = getResultsGrid();
      grid.innerHTML = "";
      if (products.length === 0) {
        var empty = document.createElement("p");
        empty.className = "collection-page__empty";
        empty.textContent = "No items match “" + query + "”.";
        grid.appendChild(empty);
        return;
      }
      products.forEach(function (product) {
        var variant = product.variants && product.variants[0];
        if (!variant) return;
        var image = product.images && product.images[0];
        var card = document.createElement("div");
        card.className = "product-card card";
        card.innerHTML =
          '<a class="product-card__link" href="/products/' + product.handle + '">' +
            '<div class="product-card__image-wrap">' +
              (image ? '<img class="product-card__image" src="' + image.src + '" alt="" loading="lazy">' : "") +
            "</div>" +
            '<p class="product-card__title"></p>' +
            '<div class="price"><span class="price__current"></span></div>' +
          "</a>";
        card.querySelector(".product-card__title").textContent = product.title;
        card.querySelector(".price__current").textContent = formatDollars(variant.price);
        grid.appendChild(card);
      });
    }

    var searchDebounce;
    var applyProductSearch = function () {
      var q = (collectionSearchInput.value || "").trim();
      var normalOutput = collectionMainEl.querySelectorAll(":scope > .collection-section, :scope > .product-grid:not(.collection-page__search-results), :scope > .collection-page__pagination, :scope > .collection-page__empty, :scope > .collection-page__load-more");

      if (q === "") {
        if (resultsGrid) resultsGrid.hidden = true;
        normalOutput.forEach(function (el) { el.hidden = false; });
        return;
      }

      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(function () {
        ensureProductCache().then(function (products) {
          var needle = q.toLowerCase();
          var matches = products.filter(function (p) {
            return p.title.toLowerCase().indexOf(needle) !== -1;
          });
          normalOutput.forEach(function (el) { el.hidden = true; });
          renderResults(matches, q);
          getResultsGrid().hidden = false;
        });
      }, 200);
    };

    if (collectionSearchInput && collectionUrl) {
      collectionSearchInput.addEventListener("input", applyProductSearch);
    }
  }

  /* ---- Mobile filter drawer ---- */
  var filterToggle = document.querySelector("[data-filter-toggle]");
  var filterPanel = document.querySelector("[data-collection-filters]");
  if (filterToggle && filterPanel) {
    filterToggle.addEventListener("click", function () {
      var open = filterPanel.classList.toggle("is-open");
      filterToggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---- Price range slider (syncs with the From/To text inputs) ---- */
  var currencyFormatter = null;
  try {
    currencyFormatter = new Intl.NumberFormat(document.documentElement.lang || "en", {
      style: "currency",
      currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD"
    });
  } catch (e) {
    currencyFormatter = null;
  }
  // Shopify's price-filter range/value objects (like every other money
  // value in Liquid: variant.price, cart totals, etc.) are expressed in
  // the shop's smallest currency unit (cents), not decimal dollars. The
  // range/number inputs below all operate on that same raw cents number
  // (so their min/max/value attributes line up with what Liquid rendered
  // and what the filter form expects back) -- these two helpers are the
  // ONLY place that ever converts between cents and a displayed dollar
  // amount, so there is exactly one place a unit mistake could happen.
  function formatPriceFromCents(cents) {
    var dollars = cents / 100;
    if (currencyFormatter) return currencyFormatter.format(dollars);
    return "$" + dollars.toFixed(2);
  }
  function parseDollarsToCents(raw) {
    var n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : Math.round(n * 100);
  }

  document.querySelectorAll("[data-price-slider]").forEach(function (slider) {
    var rangeFrom = slider.querySelector("[data-price-range-from]");
    var rangeTo = slider.querySelector("[data-price-range-to]");
    var track = slider.querySelector("[data-price-range]");
    var numberFrom = filterForm && filterForm.querySelector("[data-price-from]");
    var numberTo = filterForm && filterForm.querySelector("[data-price-to]");
    if (!rangeFrom || !rangeTo || !track) return;

    var min = parseFloat(slider.dataset.min) || 0;
    var max = parseFloat(slider.dataset.max) || 100;

    function paint() {
      var lo = Math.min(parseFloat(rangeFrom.value), parseFloat(rangeTo.value));
      var hi = Math.max(parseFloat(rangeFrom.value), parseFloat(rangeTo.value));
      var span = max - min || 1;
      track.style.left = (((lo - min) / span) * 100) + "%";
      track.style.right = (100 - ((hi - min) / span) * 100) + "%";
      // Whichever thumb is closer to the midpoint of the two values needs
      // top z-index, otherwise a click near two close-together handles can
      // grab the wrong one and "jump" it across the track.
      var mid = (parseFloat(rangeFrom.value) + parseFloat(rangeTo.value)) / 2;
      if (parseFloat(rangeFrom.value) > mid - 0.0001) {
        rangeFrom.style.zIndex = 2;
        rangeTo.style.zIndex = 1;
      } else {
        rangeFrom.style.zIndex = 1;
        rangeTo.style.zIndex = 2;
      }
    }

    function displayFormatted(input, cents) {
      if (document.activeElement !== input) input.value = formatPriceFromCents(cents);
    }

    function syncFromRange() {
      var lo = Math.min(parseFloat(rangeFrom.value), parseFloat(rangeTo.value));
      var hi = Math.max(parseFloat(rangeFrom.value), parseFloat(rangeTo.value));
      if (numberFrom) displayFormatted(numberFrom, lo);
      if (numberTo) displayFormatted(numberTo, hi);
      paint();
    }

    rangeFrom.addEventListener("input", syncFromRange);
    rangeTo.addEventListener("input", syncFromRange);
    rangeFrom.addEventListener("change", function () {
      if (filterForm) filterForm.dispatchEvent(new Event("input", { bubbles: true }));
    });
    rangeTo.addEventListener("change", function () {
      if (filterForm) filterForm.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Number inputs: show a plain editable number on focus, a formatted
    // currency string on blur, and keep them clamped to [min, max] with
    // From never exceeding To (and vice versa).
    [
      { input: numberFrom, range: rangeFrom, other: rangeTo, isFrom: true },
      { input: numberTo, range: rangeTo, other: rangeFrom, isFrom: false }
    ].forEach(function (cfg) {
      if (!cfg.input) return;
      cfg.input.addEventListener("focus", function () {
        // Show a plain editable dollar number, derived straight from the
        // authoritative cents value on the range input (not by re-parsing
        // the formatted string), so there's no drift between what's shown
        // and what's actually selected.
        cfg.input.value = (parseFloat(cfg.range.value) / 100).toFixed(2);
      });
      cfg.input.addEventListener("input", function () {
        var cents = parseDollarsToCents(cfg.input.value);
        if (cents === null) return;
        cfg.range.value = Math.min(Math.max(cents, min), max);
        paint();
      });
      cfg.input.addEventListener("blur", function () {
        var cents = parseDollarsToCents(cfg.input.value);
        if (cents === null) cents = parseFloat(cfg.range.value);
        cents = Math.min(Math.max(cents, min), max);
        if (cfg.isFrom && cents > parseFloat(cfg.other.value)) cents = parseFloat(cfg.other.value);
        if (!cfg.isFrom && cents < parseFloat(cfg.other.value)) cents = parseFloat(cfg.other.value);
        cfg.range.value = cents;
        cfg.input.value = formatPriceFromCents(cents);
        paint();
        if (filterForm) filterForm.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    if (numberFrom) numberFrom.value = formatPriceFromCents(parseFloat(rangeFrom.value));
    if (numberTo) numberTo.value = formatPriceFromCents(parseFloat(rangeTo.value));
    paint();
  });

  /* ---- Availability fallback filter (no Search & Discovery app) ----
     Client-side only: hides out-of-stock product cards and any category
     section left empty as a result. Real availability filtering still
     goes through the native `availability_filter` form control above when
     Search & Discovery provides one. */
  var instockToggle = document.querySelector("[data-instock-toggle]");
  if (instockToggle) {
    instockToggle.addEventListener("change", function () {
      var onlyInStock = instockToggle.checked;
      document.querySelectorAll(".product-card").forEach(function (card) {
        var inStock = card.getAttribute("data-in-stock") === "true";
        card.hidden = onlyInStock && !inStock;
      });
      document.querySelectorAll(".collection-section").forEach(function (section) {
        var visibleCards = section.querySelectorAll(".product-card:not([hidden])");
        section.hidden = onlyInStock && visibleCards.length === 0;
      });
    });
  }

  var sortSelect = document.querySelector("[data-sort-select]");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      beginNavigating();
      var url = new URL(window.location.href);
      url.searchParams.set("sort_by", sortSelect.value);
      window.location.href = url.toString();
    });
  }

  /* ---- Add to cart forms (product page) ---- */
  document.querySelectorAll("form[data-add-to-cart-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.hasAttribute("data-pending")) return;
      var submitBtn = form.querySelector('[type="submit"]');
      form.setAttribute("data-pending", "true");
      if (submitBtn) submitBtn.disabled = true;

      var formData = new FormData(form);
      formData.append("sections", "cart-drawer");
      fetch(shopifyRoot() + "cart/add.js", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      })
        .then(function (r) { return r.json(); })
        .then(function (result) {
          if (result && !result.status) {
            applyCartUpdate(result, result.sections && result.sections["cart-drawer"]);
            openCartDrawer();
          }
        })
        .catch(function () {})
        .then(function () {
          form.removeAttribute("data-pending");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  });

  /* ---- Variant modal (product cards with multiple variants, e.g.
     Normal/Neon/Mega) ----
     One shared modal instance (snippets/variant-modal.liquid) reused for
     every product card rather than one per card -- see that file's header
     comment. Its <form data-add-to-cart-form> is already picked up by the
     generic handler above; this block only has to populate the modal's
     content and swap which variant that form's hidden `id` input points
     at. Prices come from product.variants | json (raw cents, Shopify's own
     API shape) and go through the same formatPriceFromCents() the price
     slider above uses, so there's exactly one place currency formatting
     can go wrong, not two. */
  var variantModal = document.querySelector("[data-variant-modal]");
  if (variantModal) {
    var vmImage = variantModal.querySelector("[data-variant-modal-image]");
    var vmTitle = variantModal.querySelector("[data-variant-modal-title]");
    var vmPrice = variantModal.querySelector("[data-variant-modal-price]");
    var vmCompare = variantModal.querySelector("[data-variant-modal-compare]");
    var vmCompareValue = variantModal.querySelector("[data-variant-modal-compare-value]");
    var vmOptions = variantModal.querySelector("[data-variant-modal-options]");
    var vmForm = variantModal.querySelector("[data-variant-modal-form]");
    var vmIdInput = variantModal.querySelector("[data-variant-modal-id-input]");
    var vmSubmit = variantModal.querySelector("[data-variant-modal-submit]");
    var vmSubmitLabel = variantModal.querySelector("[data-variant-modal-submit-label]");
    var vmLabelAdd = (vmSubmit && vmSubmit.dataset.labelAdd) || "Add";
    var vmLabelSoldOut = (vmSubmit && vmSubmit.dataset.labelSoldOut) || "Out of stock";
    var vmLabelSelect = (vmSubmitLabel && vmSubmitLabel.textContent) || "Select a variant";

    function openVariantModal() {
      variantModal.hidden = false;
      document.body.classList.add("variant-modal-open");
      requestAnimationFrame(function () {
        variantModal.classList.add("is-open");
      });
    }

    function closeVariantModal() {
      variantModal.classList.remove("is-open");
      document.body.classList.remove("variant-modal-open");
      window.setTimeout(function () {
        variantModal.hidden = true;
      }, 200);
    }

    function resetVariantModalSelection() {
      vmOptions.querySelectorAll("[data-variant-option]").forEach(function (btn) {
        btn.classList.remove("is-selected");
        btn.setAttribute("aria-pressed", "false");
      });
      vmIdInput.value = "";
      vmSubmit.disabled = true;
      vmSubmitLabel.textContent = vmLabelSelect;
    }

    function selectVariant(variant, button) {
      vmOptions.querySelectorAll("[data-variant-option]").forEach(function (btn) {
        var selected = btn === button;
        btn.classList.toggle("is-selected", selected);
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      vmIdInput.value = variant.id;
      if (variant.featured_image && variant.featured_image.src) {
        vmImage.src = variant.featured_image.src;
      }
      vmSubmit.disabled = !variant.available;
      vmSubmitLabel.textContent = variant.available ? vmLabelAdd : vmLabelSoldOut;
    }

    function buildVariantOption(variant) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "variant-modal__option";
      btn.setAttribute("data-variant-option", "");
      btn.setAttribute("aria-pressed", "false");
      if (!variant.available) btn.classList.add("is-unavailable");

      var name = document.createElement("span");
      name.className = "variant-modal__option-name";
      name.textContent = variant.title;

      var price = document.createElement("span");
      price.className = "variant-modal__option-price";
      price.textContent = variant.available ? formatPriceFromCents(variant.price) : vmLabelSoldOut;

      btn.appendChild(name);
      btn.appendChild(price);
      btn.addEventListener("click", function () {
        selectVariant(variant, btn);
      });
      return btn;
    }

    function parseVariants(trigger) {
      try {
        return JSON.parse(trigger.dataset.variants || "[]");
      } catch (e) {
        return [];
      }
    }

    function populateAndOpenModal(trigger, variants) {
      vmTitle.textContent = trigger.dataset.productTitle || "";
      vmImage.src = trigger.dataset.productImage || "";
      vmImage.alt = trigger.dataset.productTitle || "";
      vmPrice.textContent = trigger.dataset.productPrice || "";
      if (trigger.dataset.productComparePrice) {
        vmCompareValue.textContent = trigger.dataset.productComparePrice;
        vmCompare.hidden = false;
      } else {
        vmCompare.hidden = true;
      }

      vmOptions.innerHTML = "";
      variants.forEach(function (variant) {
        vmOptions.appendChild(buildVariantOption(variant));
      });
      resetVariantModalSelection();
      openVariantModal();
    }

    // The explicit "Add" button on a card only ever renders when the
    // product actually has more than one variant (see product-card.liquid),
    // so it can go straight to the modal with no branching.
    document.querySelectorAll("[data-variant-modal-trigger]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var variants = parseVariants(trigger);
        if (!variants.length) return;
        populateAndOpenModal(trigger, variants);
      });
    });

    // Card-wide activation: the image/title/price link does the same
    // thing the "Add" button does -- open the modal for a multi-variant
    // product, or add straight to cart for a single-variant one -- instead
    // of navigating to the product page. Still a real <a href>, so a
    // modifier-click (new tab), middle-click, or right-click still reaches
    // the actual product page; only a plain left-click is intercepted.
    document.querySelectorAll("[data-card-activate]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var variants = parseVariants(link);
        if (!variants.length) return;
        e.preventDefault();

        if (variants.length > 1) {
          populateAndOpenModal(link, variants);
          return;
        }

        var only = variants[0];
        if (!only.available) return;
        var card = link.closest(".product-card");
        var form = card && card.querySelector("form[data-add-to-cart-form]");
        if (form) {
          form.requestSubmit ? form.requestSubmit() : form.submit();
        }
      });
    });

    variantModal.querySelectorAll("[data-variant-modal-close]").forEach(function (el) {
      el.addEventListener("click", closeVariantModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !variantModal.hidden) closeVariantModal();
    });
    if (vmForm) {
      vmForm.addEventListener("submit", function () {
        closeVariantModal();
      });
    }
  }
})();
