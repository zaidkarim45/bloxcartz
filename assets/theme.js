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

  /* ---- Cart mutations (Shopify Ajax Cart API) ---- */

  function refreshCartUI(cart) {
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = cart.item_count;
    });
    document.querySelectorAll("[data-cart-total], [data-cart-subtotal]").forEach(function (el) {
      el.textContent = formatMoney(cart.total_price);
    });
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString(document.documentElement.lang || "en", {
      style: "currency",
      currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD"
    });
  }

  function postCartChange(body) {
    return fetch(window.Shopify && Shopify.routes ? Shopify.routes.root + "cart/change.js" : "/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  document.addEventListener("click", function (e) {
    var increase = e.target.closest("[data-qty-increase]");
    var remove = e.target.closest("[data-qty-remove]");
    var target = increase || remove;
    if (!target) return;

    var line = target.closest("[data-cart-line]");
    if (!line) return;
    var key = line.getAttribute("data-line-key");
    var qtyEl = line.querySelector("[data-qty-value]");
    var currentQty = qtyEl ? parseInt(qtyEl.textContent, 10) || 0 : 0;
    var newQty = increase ? currentQty + 1 : 0;

    postCartChange({ id: key, quantity: newQty }).then(function (cart) {
      if (newQty === 0) {
        line.remove();
      } else if (qtyEl) {
        qtyEl.textContent = newQty;
      }
      refreshCartUI(cart);
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
  var collectionSearchForm = document.querySelector(".collection-page__search");
  if (collectionSearchForm) collectionSearchForm.addEventListener("submit", beginNavigating);

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
      var formData = new FormData(form);
      fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : "/") + "cart/add.js", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          return fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : "/") + "cart.js");
        })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          refreshCartUI(cart);
          openCartDrawer();
        });
    });
  });
})();
