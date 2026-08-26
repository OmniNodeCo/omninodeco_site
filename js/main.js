/* ============================================================
   OmniNodeCo — site interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Site config ----------
     FORM_ENDPOINT: paste a Formspree (or similar) endpoint to POST
     the contact form. Leave empty to fall back to a mailto: link. */
  var CONFIG = {
    FORM_ENDPOINT: "", // e.g. "https://formspree.io/f/yourFormId"
    CONTACT_EMAIL: "hello@omninodeco.com",
  };

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Sticky nav state ---------- */
  var nav = document.getElementById("nav");
  var toggle = document.getElementById("navToggle");

  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 8) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", nav.classList.contains("open"));
    });

    // Close the menu when a link is chosen (mobile)
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 0.07 + "s";
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  /* ---------- Project filtering (projects page) ---------- */
  var filterBtns = document.querySelectorAll(".filter-btn");
  var projectCards = document.querySelectorAll("[data-category]");

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");

      var filter = btn.getAttribute("data-filter");

      projectCards.forEach(function (card) {
        var show = filter === "all" || card.getAttribute("data-category") === filter;
        card.style.display = show ? "" : "none";
        if (show) {
          // Re-trigger reveal for hidden cards coming back into view
          requestAnimationFrame(function () {
            card.classList.add("in-view");
          });
        }
      });
    });
  });

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contactForm");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var status = document.getElementById("formStatus");
      var submitBtn = form.querySelector('[type="submit"]');
      var originalLabel = submitBtn.textContent;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var data = new FormData(form);
      var subject = "Website enquiry: " + (data.get("subject") || "General");

      if (CONFIG.FORM_ENDPOINT) {
        // POST to a form service (Formspree etc.)
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";

        fetch(CONFIG.FORM_ENDPOINT, {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" },
        })
          .then(function (res) {
            if (res.ok) return res.json();
            throw new Error("Bad response");
          })
          .then(function () {
            showStatus(status, "Thanks! Your message is on its way — we reply within one business day.", true);
            form.reset();
          })
          .catch(function () {
            showStatus(status, "Something went wrong. Please email us directly at " + CONFIG.CONTACT_EMAIL + ".", false);
          })
          .finally(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          });
      } else {
        // Fallback: open the visitor's mail client with a pre-filled email
        var body = encodeURIComponent(
          "Name: " + data.get("name") + "\nCompany: " + (data.get("company") || "-") +
          "\n\n" + (data.get("message") || "")
        );
        var mailto =
          "mailto:" + CONFIG.CONTACT_EMAIL +
          "?subject=" + encodeURIComponent(subject) + "&body=" + body;

        showStatus(status, "Opening your email app… if nothing happens, email us at " + CONFIG.CONTACT_EMAIL + ".", true);
        window.location.href = mailto;
      }
    });

    function showStatus(el, message, ok) {
      if (!el) return;
      el.textContent = message;
      el.className = "form-status " + (ok ? "ok" : "err");
    }
  }
})();
