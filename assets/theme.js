(function () {
  "use strict";

  /* ---- Header: game select dropdown ---- */
  document.querySelectorAll("[data-game-select]").forEach(function (root) {
    var btn = root.querySelector(".site-header__game-select-btn");
    var menu = root.querySelector(".site-header__game-menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) {
        btn.setAttribute("aria-expanded", "false");
        menu.hidden = true;
      }
    });
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
  var filterForm = document.querySelector("[data-filter-form]");
  if (filterForm) {
    var debounceTimer;
    filterForm.addEventListener("input", function (e) {
      window.clearTimeout(debounceTimer);
      var delay = e.target.type === "number" ? 500 : 0;
      debounceTimer = window.setTimeout(function () {
        filterForm.requestSubmit ? filterForm.requestSubmit() : filterForm.submit();
      }, delay);
    });
  }

  var sortSelect = document.querySelector("[data-sort-select]");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
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
