(function () {
  const $ = id => document.getElementById(id);

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function eventIsLive(event) {
    if (!event?.is_active) return false;
    const now = new Date();
    const start = event.start_date ? new Date(`${event.start_date}T00:00:00`) : null;
    const end = event.end_date ? new Date(`${event.end_date}T23:59:59`) : null;
    return (!start || start <= now) && (!end || end >= now);
  }

  function formatEventDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
  }

  function applyTheme(theme) {
    document.body.classList.toggle("light", theme === "light");
    const button = $("themeButton");
    if (button) {
      button.innerHTML = `<span aria-hidden="true">${theme === "light" ? "◒" : "◐"}</span>`;
      button.setAttribute("aria-label", theme === "light" ? "Gunakan tema gelap" : "Gunakan tema cerah");
      button.setAttribute("title", theme === "light" ? "Gunakan tema gelap" : "Gunakan tema cerah");
    }
  }

  applyTheme(localStorage.getItem("iasb-theme") || "dark");

  $("themeButton")?.addEventListener("click", () => {
    const theme = document.body.classList.contains("light") ? "dark" : "light";
    localStorage.setItem("iasb-theme", theme);
    applyTheme(theme);
  });

  $("menuButton")?.addEventListener("click", () => {
    const nav = $("siteNav");
    const open = nav.classList.toggle("open");
    $("menuButton").setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll("#siteNav a").forEach(link => {
    const current = location.pathname.split("/").pop() || "index.html";
    const target = link.getAttribute("href").split("#")[0] || "index.html";
    link.classList.toggle("active", current === target);
    link.addEventListener("click", () => $("siteNav")?.classList.remove("open"));
  });

  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);

  const quickActions = document.createElement("div");
  quickActions.className = "quick-actions";
  quickActions.innerHTML = `
    <a class="floating-whatsapp" data-floating-whatsapp target="_blank" rel="noopener" aria-label="WhatsApp Izuwan Automobile">
      <span>WhatsApp</span><b>↗</b>
    </a>
    <button class="back-to-top" type="button" aria-label="Kembali ke atas">↑</button>`;
  document.body.appendChild(quickActions);

  const mobileActions = document.createElement("nav");
  mobileActions.className = "mobile-action-bar";
  mobileActions.setAttribute("aria-label", "Tindakan pantas");
  mobileActions.innerHTML = `
    <a data-mobile-whatsapp target="_blank" rel="noopener"><span aria-hidden="true">WA</span><b>WhatsApp</b></a>
    <a href="inventory.html"><span aria-hidden="true">⌕</span><b>Inventory</b></a>
    <a href="calculator.html"><span aria-hidden="true">RM</span><b>Calculator</b></a>`;
  document.body.appendChild(mobileActions);

  const backToTop = quickActions.querySelector(".back-to-top");
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  function updateScrollUi() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    document.querySelector(".page-topbar")?.classList.toggle("scrolled", window.scrollY > 18);
    backToTop.classList.toggle("visible", window.scrollY > 650);
  }
  window.addEventListener("scroll", updateScrollUi, { passive: true });
  updateScrollUi();

  const revealTargets = document.querySelectorAll(
    ".home-intro, .home-services article, .brand-proof article, .programme-feature, " +
    ".services-band article, .hq-strip, .profile-grid, .values-grid article, .journey-section li, " +
    ".inventory-card, .process-grid article, .programme-benefits > div, .contact-layout > div, " +
    ".team-grid article, .social-strip, .tool-next, .calculator-shell, .otr-shell"
  );
  revealTargets.forEach((node, index) => {
    node.classList.add("reveal");
    node.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 65}ms`);
  });

  if ("IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !window.matchMedia("(max-width: 600px)").matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -45px" });
    revealTargets.forEach(node => observer.observe(node));
  } else {
    revealTargets.forEach(node => node.classList.add("revealed"));
  }

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("pointermove", event => {
      const card = event.target.closest(
        ".inventory-card, .home-services article, .values-grid article, .services-band article, .process-grid article, .team-grid article"
      );
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
    });
  }

  window.IASBSite = {
    settings: null,
    salesmen: [],
    whatsappUrl(message, preferredNumber = "") {
      const number = preferredNumber || this.settings?.whatsapp_number || window.IASB_CONFIG?.fallbackWhatsapp || "";
      const base = number ? `https://wa.me/${number.replace(/\D/g, "")}` : "https://wa.me/";
      return `${base}?text=${encodeURIComponent(message)}`;
    },
    applyManagedData(settings, salesmen, events = []) {
      this.settings = settings || null;
      this.salesmen = salesmen || [];
      const company = settings?.company_name || "Izuwan Automobile";
      const shortName = company.split(" ")[0].toUpperCase();

      document.querySelectorAll("[data-company-name]").forEach(node => {
        node.textContent = company;
      });
      document.querySelectorAll("[data-brand-name]").forEach(node => {
        node.textContent = shortName;
      });
      document.querySelectorAll("[data-pricelist-date]").forEach(node => {
        node.textContent = settings?.pricelist_date || "Terkini";
      });
      document.querySelectorAll("[data-main-whatsapp]").forEach(link => {
        const programmePage = location.pathname.includes("select-programme");
        link.href = this.whatsappUrl(programmePage
          ? "Hai, saya berminat dengan Izuwan Select Programme dan ingin source kereta dari Jepun."
          : "Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.");
      });
      document.querySelectorAll("[data-floating-whatsapp]").forEach(link => {
        link.href = this.whatsappUrl("Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.");
      });
      document.querySelectorAll("[data-mobile-whatsapp]").forEach(link => {
        link.href = this.whatsappUrl("Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.");
      });

      if (settings?.promotion_banner) {
        document.querySelectorAll("[data-promotion-banner]").forEach(node => {
          node.textContent = settings.promotion_banner;
          node.classList.remove("hidden");
        });
      }

      const liveEvent = (events || []).find(eventIsLive);
      document.querySelector(".site-event-banner")?.remove();
      if (liveEvent) {
        const banner = document.createElement("section");
        banner.className = "site-event-banner";
        const dateText = [formatEventDate(liveEvent.start_date), formatEventDate(liveEvent.end_date)].filter(Boolean).join(" – ");
        const message = liveEvent.cta_message || `Hai, saya nak tahu info lanjut tentang ${liveEvent.title}.`;
        banner.innerHTML = `
          <div class="site-event-media">${liveEvent.banner_url ? `<img src="${safeText(liveEvent.banner_url)}" alt="${safeText(liveEvent.title)}">` : `<span>IA</span>`}</div>
          <div class="site-event-copy">
            <small>${safeText(liveEvent.kicker || "SPECIAL EVENT")}</small>
            <h2>${safeText(liveEvent.title)}</h2>
            <p>${safeText(liveEvent.subtitle || liveEvent.description || "Event khas Izuwan Automobile sedang berlangsung.")}</p>
            <span>${safeText([dateText, liveEvent.location].filter(Boolean).join(" · "))}</span>
          </div>
          <div class="site-event-actions">
            <a class="event-details-link" href="events.html">Info lanjut</a>
            <a class="event-whatsapp-link" href="${this.whatsappUrl(message)}" target="_blank" rel="noopener">${safeText(liveEvent.cta_label || "WhatsApp")} <b>↗</b></a>
          </div>`;
        document.querySelector(".page-topbar")?.insertAdjacentElement("afterend", banner);
      }

      if (settings?.logo_url) {
        document.querySelectorAll("[data-brand-logo]").forEach(image => {
          image.src = settings.logo_url;
          image.classList.remove("hidden");
        });
        document.querySelectorAll("[data-brand-mark]").forEach(mark => mark.classList.add("hidden"));
      }
    }
  };

  window.IASBSite.applyManagedData(null, [], []);

  (async function loadSharedData() {
    try {
      if (!window.IASBData?.configured) return;
      const managed = await window.IASBData.loadPublicData();
      window.IASBSite.applyManagedData(managed.settings, managed.salesmen, managed.events);
      window.dispatchEvent(new CustomEvent("iasb:data", { detail: managed }));
    } catch (error) {
      console.warn("Managed site data unavailable.", error);
      window.dispatchEvent(new CustomEvent("iasb:error", { detail: { error } }));
    }
  })();
})();
