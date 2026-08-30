(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.querySelector("[data-infinite-grid]");
    var wrap = document.querySelector("[data-load-more-wrap]");
    if (!grid || !wrap) return;

    var btn = wrap.querySelector("[data-load-more-btn]");
    var progress = wrap.querySelector("[data-load-progress]");
    var sentinel = wrap.querySelector("[data-load-sentinel]");
    var loading = false;

    function totalPages() {
      return parseInt(grid.getAttribute("data-total-pages"), 10) || 1;
    }
    function nextPage() {
      return parseInt(grid.getAttribute("data-next-page"), 10) || 2;
    }

    function buildUrl(page) {
      var params = new URLSearchParams(window.location.search);
      params.set("page", page);
      params.set("section_id", grid.getAttribute("data-section-id"));
      return window.location.pathname + "?" + params.toString();
    }

    function setLoading(state) {
      loading = state;
      if (btn) {
        btn.disabled = state;
        btn.classList.toggle("is-loading", state);
      }
    }

    function loadNext() {
      if (loading) return;
      var page = nextPage();
      if (page > totalPages()) return;

      setLoading(true);
      fetch(buildUrl(page))
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var newGrid = doc.querySelector("[data-infinite-grid]");
          if (!newGrid) return;

          var cards = Array.prototype.slice.call(newGrid.children);
          cards.forEach(function (card, i) {
            card.classList.add("product-card--enter");
            grid.appendChild(card);
            window.requestAnimationFrame(function () {
              setTimeout(function () {
                card.classList.add("product-card--enter-active");
              }, i * 25);
            });
          });

          var loadedCount = parseInt(grid.getAttribute("data-loaded-count"), 10) || 0;
          loadedCount += cards.length;
          grid.setAttribute("data-loaded-count", loadedCount);
          grid.setAttribute("data-next-page", page + 1);

          var total = grid.getAttribute("data-total-count");
          if (progress) {
            progress.textContent = "Showing " + loadedCount + " of " + total + " items";
          }

          if (page + 1 > totalPages()) {
            wrap.classList.add("is-exhausted");
          }
          setLoading(false);
          document.dispatchEvent(new CustomEvent("products:appended"));
        })
        .catch(function () {
          setLoading(false);
        });
    }

    if (btn) btn.addEventListener("click", loadNext);

    if ("IntersectionObserver" in window && sentinel) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) loadNext();
          });
        },
        { rootMargin: "400px 0px 0px 0px" }
      );
      observer.observe(sentinel);
    }
  });
})();
