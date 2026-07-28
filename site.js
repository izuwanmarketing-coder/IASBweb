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

  const stockStatusLabels = {
    AVAILABLE: "Ready Stock",
    INCOMING: "Akan Tiba",
    "PORT KLANG": "Di Pelabuhan",
    "DONE PAID DUTI": "Sedia Diproses",
    RESERVED: "Ditempah",
    BOOKED: "Ditempah",
    SOLD: "Terjual"
  };

  const mainContent = document.querySelector("main");
  if (mainContent) {
    mainContent.id ||= "main-content";
    const skipLink = document.createElement("a");
    skipLink.className = "skip-link";
    skipLink.href = "#main-content";
    skipLink.textContent = "Langkau ke kandungan utama";
    document.body.prepend(skipLink);
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

  const mainNav = $("siteNav");
  if (mainNav) {
    mainNav.setAttribute("aria-label", "Navigasi utama");
    mainNav.innerHTML = `
      <a href="inventory.html">Inventory</a>
      <a href="find-car.html">Find My Car</a>
      <a href="select-programme.html">Select Programme</a>
      <a href="about.html">About</a>
      <a href="contact.html">Contact</a>
      <a class="tool-nav-link" href="calculator.html">Tools</a>`;
  }
  const footerNav = document.querySelector(".site-footer nav");
  if (footerNav) {
    footerNav.innerHTML = `
      <a href="inventory.html">Inventory</a>
      <a href="about.html">About</a>
      <a href="select-programme.html">Select Programme</a>
      <a href="contact.html">Contact</a>
      <a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>`;
    footerNav.setAttribute("aria-label", "Navigasi footer");
  }
  $("menuButton")?.setAttribute("aria-controls", "siteNav");

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
    if (current === target) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    link.addEventListener("click", () => {
      $("siteNav")?.classList.remove("open");
      $("menuButton")?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !$("siteNav")?.classList.contains("open")) return;
    $("siteNav").classList.remove("open");
    $("menuButton")?.setAttribute("aria-expanded", "false");
    $("menuButton")?.focus();
  });

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
  mobileActions.setAttribute("aria-label", "Navigasi utama mudah alih");
  const currentPage = location.pathname.split("/").pop() || "index.html";
  const mobileMessage = currentPage === "contact.html"
    ? "Hai, saya ingin buat temu janji untuk melawat HQ Izuwan Automobile di Taman Wahyu."
    : currentPage === "select-programme.html"
      ? "Hai, saya berminat dengan Izuwan Select Programme dan ingin source kereta dari Jepun."
      : "Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.";
  const activeMobileItem = currentPage === "index.html"
    ? "home"
    : ["inventory.html", "car.html"].includes(currentPage)
      ? "stock"
      : ["find-car.html", "select-programme.html"].includes(currentPage)
        ? "find"
        : ["calculator.html", "otr.html", "model-guides.html"].includes(currentPage)
          ? "tools"
          : "";
  const mobileIcons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nav-fill" d="M3.5 10.6 12 3.8l8.5 6.8v9a1.4 1.4 0 0 1-1.4 1.4h-4.6v-6.2h-5V21H4.9a1.4 1.4 0 0 1-1.4-1.4z"/></svg>`,
    stock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 16.8h13.6l-1.2-5.1a2.5 2.5 0 0 0-2.4-1.9H8.8a2.5 2.5 0 0 0-2.4 1.9z"/><path d="M3.5 16.8h17v2.3a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4zM6.3 9.8 8 6.5h8l1.7 3.3"/><circle cx="7" cy="17.5" r="1.1"/><circle cx="17" cy="17.5" r="1.1"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L4 20l1.1-4a8.2 8.2 0 1 1 15.1-4.3Z"/><path d="M9.1 8.2c.2-.5.4-.5.8-.5h.4c.1 0 .3 0 .4.4l.8 1.9c.1.3.1.5-.1.7l-.6.7c-.2.2-.2.4 0 .7.7 1.2 1.7 2.1 2.9 2.7.3.2.5.1.7-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.5.2.5.4 0 .2-.1 1.2-.6 1.7-.5.6-1.4.9-2.2.9-.6 0-1.4-.2-2.5-.7-1.4-.6-2.5-1.4-3.5-2.4-1-1-1.8-2.2-2.3-3.4-.5-1.1-.5-2-.4-2.6.1-.5.3-1 .6-1.4Z"/></svg>`,
    find: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 5.2 5.2M10.5 7.7v5.6M7.7 10.5h5.6"/></svg>`,
    tools: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="2.2"/><path d="M7.5 7.2h9M8 11h1M12 11h1M16 11h1M8 14.5h1M12 14.5h1M16 14.5h1M8 18h1M12 18h1M16 18h1"/></svg>`
  };
  const mobileItems = [
    { key: "home", href: "index.html", label: "Home" },
    { key: "stock", href: "inventory.html", label: "Stock" },
    { key: "whatsapp", label: "WhatsApp", primary: true },
    { key: "find", href: "find-car.html", label: "Find Car" },
    { key: "tools", href: "calculator.html", label: "Tools" }
  ];
  mobileActions.innerHTML = mobileItems.map(item => {
    const isActive = item.key === activeMobileItem;
    const attributes = item.primary
      ? `data-mobile-whatsapp data-whatsapp-message="${safeText(mobileMessage)}" target="_blank" rel="noopener" aria-label="WhatsApp Izuwan Automobile"`
      : `href="${item.href}"${isActive ? ' aria-current="page"' : ""}`;
    return `<a class="mobile-nav-item${item.primary ? " mobile-nav-primary" : ""}${isActive ? " active" : ""}" ${attributes}>
      <span class="mobile-nav-icon">${mobileIcons[item.key]}</span>
      <b>${item.label}</b>
    </a>`;
  }).join("");
  document.body.appendChild(mobileActions);

  const backToTop = quickActions.querySelector(".back-to-top");
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  function updateScrollUi() {
    document.querySelector(".page-topbar")?.classList.toggle("scrolled", window.scrollY > 18);
    backToTop.classList.toggle("visible", window.scrollY > 650);
  }
  window.addEventListener("scroll", updateScrollUi, { passive: true });
  updateScrollUi();

  const revealTargets = document.querySelectorAll(
    ".pathway-heading, .pathway-grid a, .featured-stock-section > .section-heading, " +
    ".delivered-section > .section-heading, .home-cta, .home-intro, .home-services article, " +
    ".brand-proof article, .programme-feature, " +
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

  window.IASBSite = {
    settings: null,
    salesmen: [],
    statusLabel(value) {
      return stockStatusLabels[String(value || "AVAILABLE").toUpperCase()] || String(value || "Ready Stock");
    },
    financeAssumptions() {
      return {
        depositPct: 10,
        years: 9,
        rate: Number(this.settings?.default_interest) || 3.2
      };
    },
    monthlyEstimate(price, options = {}) {
      const assumptions = { ...this.financeAssumptions(), ...options };
      const vehiclePrice = Math.max(0, Number(price) || 0);
      const deposit = options.downpayment === undefined
        ? vehiclePrice * (Number(assumptions.depositPct) || 0) / 100
        : Math.max(0, Number(options.downpayment) || 0);
      const principal = Math.max(0, vehiclePrice - deposit);
      const years = Math.max(1, Number(assumptions.years) || 9);
      const rate = Math.max(0, Number(assumptions.rate) || 0);
      return Math.round((principal + principal * (rate / 100) * years) / (years * 12));
    },
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
        const customMessage = link.dataset.whatsappMessage;
        link.href = this.whatsappUrl(customMessage || (programmePage
          ? "Hai, saya berminat dengan Izuwan Select Programme dan ingin source kereta dari Jepun."
          : "Hai, saya ingin bertanya tentang kereta di Izuwan Automobile."));
      });
      document.querySelectorAll("[data-floating-whatsapp]").forEach(link => {
        link.href = this.whatsappUrl("Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.");
      });
      document.querySelectorAll("[data-mobile-whatsapp]").forEach(link => {
        link.href = this.whatsappUrl(link.dataset.whatsappMessage || "Hai, saya ingin bertanya tentang kereta di Izuwan Automobile.");
      });

      const liveEvent = (events || []).find(eventIsLive);
      if (settings?.promotion_banner && !liveEvent) {
        document.querySelectorAll("[data-promotion-banner]").forEach(node => {
          node.textContent = settings.promotion_banner;
          node.classList.remove("hidden");
        });
      } else {
        document.querySelectorAll("[data-promotion-banner]").forEach(node => node.classList.add("hidden"));
      }

      document.querySelector(".site-event-banner")?.remove();
      const showEventBanner = Boolean(liveEvent && currentPage === "index.html");
      document.body.classList.toggle("has-live-event", showEventBanner);
      if (showEventBanner) {
        const banner = document.createElement("section");
        banner.className = "site-event-banner";
        const dateText = [formatEventDate(liveEvent.start_date), formatEventDate(liveEvent.end_date)].filter(Boolean).join(" – ");
        const message = liveEvent.cta_message || `Hai, saya nak tahu info lanjut tentang ${liveEvent.title}.`;
        const managedCta = liveEvent.cta_label || "WhatsApp";
        const ctaText = managedCta.length > 20 ? "WhatsApp tawaran" : managedCta;
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
            <a class="event-whatsapp-link" href="${this.whatsappUrl(message)}" target="_blank" rel="noopener">${safeText(ctaText)} <b>↗</b></a>
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
      if (!window.IASBData?.configured && !window.IASBData?.sheetConfigured) return;
      const managed = await window.IASBData.loadPublicData();
      window.IASBSite.applyManagedData(managed.settings, managed.salesmen, managed.events);
      window.dispatchEvent(new CustomEvent("iasb:data", { detail: managed }));
    } catch (error) {
      console.warn("Managed site data unavailable.", error);
      window.dispatchEvent(new CustomEvent("iasb:error", { detail: { error } }));
    }
  })();
})();
