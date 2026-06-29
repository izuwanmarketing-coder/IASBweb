(function () {
  const root = document.getElementById("eventsDetail");
  if (!root) return;

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isLive(event) {
    if (!event?.is_active) return false;
    const now = new Date();
    const start = event.start_date ? new Date(`${event.start_date}T00:00:00`) : null;
    const end = event.end_date ? new Date(`${event.end_date}T23:59:59`) : null;
    return (!start || start <= now) && (!end || end >= now);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
  }

  function countdownText(event) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = event.start_date ? new Date(`${event.start_date}T00:00:00`) : null;
    const end = event.end_date ? new Date(`${event.end_date}T23:59:59`) : null;
    if (start && start > now) return `${Math.ceil((start - now) / 86400000)} hari lagi`;
    if (end && end >= now) return `${Math.max(1, Math.ceil((end - now) / 86400000))} hari berbaki`;
    return "Live sekarang";
  }

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;

  function animatePanels() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.querySelectorAll(".event-animate").forEach(node => node.classList.add("event-in"));
      return;
    }
    root.querySelectorAll(".event-animate").forEach((node, index) => {
      node.style.setProperty("--event-enter-delay", `${Math.min(index, 8) * 70}ms`);
      requestAnimationFrame(() => node.classList.add("event-in"));
    });
  }

  function campaignCars(event, inventory) {
    const tag = String(event.campaign_tag || event.title || "").trim().toLowerCase();
    if (!tag) return [];
    return (inventory || []).filter(car => String(car.campaign_tag || "").trim().toLowerCase() === tag).slice(0, 8);
  }

  function descriptionParts(text) {
    const fallback = "Event khas Izuwan Automobile sedang berlangsung.";
    const raw = String(text || fallback).replace(/\r/g, "").trim();
    if (!raw) return { intro: fallback, bullets: [] };

    const normalized = raw
      .replace(/\s*[|]\s*/g, " | ")
      .replace(/\s*[•·]\s*/g, " | ")
      .replace(/\n-\s*/g, "\n")
      .replace(/\n\*\s*/g, "\n");

    const paragraphs = normalized.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      const [intro, ...rest] = paragraphs;
      return { intro, bullets: rest.filter(Boolean) };
    }

    const chunks = normalized.split(/\s+\|\s+/).map(chunk => chunk.trim()).filter(Boolean);
    if (chunks.length >= 2) {
      const [intro, ...bullets] = chunks;
      return { intro, bullets };
    }

    return { intro: raw, bullets: [] };
  }

  function formatEventDescription(text) {
    const { intro, bullets } = descriptionParts(text);
    if (bullets.length) {
      return `
        <p>${safeText(intro)}</p>
        <ul>${bullets.map(item => `<li>${safeText(item)}</li>`).join("")}</ul>
      `;
    }
    return `<p>${safeText(intro)}</p>`;
  }

  function eventHighlights(event, inventory) {
    const { bullets } = descriptionParts(event.description || event.subtitle);
    const cars = campaignCars(event, inventory);
    const fallback = [
      "Ready stock terpilih dengan tawaran eksklusif sepanjang campaign.",
      "Team bantu semak loan, insurance dan trade-in dalam satu flow yang mudah.",
      "Boleh terus set viewing slot ke HQ untuk tengok unit sebenar.",
      cars.length
        ? `${cars.length} unit sudah dipadankan di bawah campaign ini.`
        : "Boleh terus WhatsApp untuk minta shortlist unit yang paling ngam."
    ];
    return (bullets.length ? bullets : fallback).slice(0, 4);
  }

  function eventStats(event, inventory) {
    const cars = campaignCars(event, inventory);
    const prices = cars.map(car => Number(car.price || 0)).filter(Boolean);
    const locations = new Set(cars.map(car => car.location).filter(Boolean));
    return [
      { label: "Status campaign", value: countdownText(event), detail: event.kicker || "Special event" },
      { label: "Participating stock", value: `${cars.length || "Selected"} unit`, detail: cars.length ? "Matched from inventory" : "Team-curated selection" },
      { label: "Entry price", value: prices.length ? money(Math.min(...prices)) : "WhatsApp us", detail: prices.length ? "From event stock list" : "Ask for event pricing" },
      { label: "Location", value: event.location || "HQ Taman Wahyu", detail: `${locations.size || 1} showroom point` }
    ];
  }

  function renderEventStats(event, inventory) {
    return `<section class="event-stats-grid event-animate">
      ${eventStats(event, inventory).map(item => `
        <article class="event-stat-card glass-card">
          <span>${safeText(item.label)}</span>
          <strong>${safeText(item.value)}</strong>
          <small>${safeText(item.detail)}</small>
        </article>
      `).join("")}
    </section>`;
  }

  function renderHighlights(event, inventory) {
    return `<section class="event-highlights event-animate">
      <div class="event-section-heading">
        <span>WHY THIS EVENT HITS DIFFERENT</span>
        <h3>Highlights yang bagi alasan jelas untuk act sekarang.</h3>
      </div>
      <div class="event-highlights-grid">
        ${eventHighlights(event, inventory).map((item, index) => `
          <article class="event-highlight-card glass-card">
            <b>0${index + 1}</b>
            <p>${safeText(item)}</p>
          </article>
        `).join("")}
      </div>
    </section>`;
  }

  function renderActionDeck(event, inventory) {
    const cars = campaignCars(event, inventory);
    const mainMessage = event.cta_message || `[Events Page] Hai, saya nak tahu info lanjut tentang ${event.title}.`;
    const viewingMessage = `[Events Page] Hai, saya nak book viewing slot untuk campaign ${event.title}.`;
    return `<section class="event-action-deck event-animate">
      <article class="event-action-card glass-card">
        <span>PLAN YOUR VISIT</span>
        <h3>Tengok sendiri unit yang masuk dalam campaign ni.</h3>
        <p>HQ kami di Taman Wahyu dibuka 9am - 7pm. Datang untuk survey, viewing, trade-in discussion, atau terus semak pakej loan yang sesuai.</p>
        <div class="event-action-list">
          <div><b>Viewing slot</b><small>Boleh walk-in atau set masa terus dengan team.</small></div>
          <div><b>Trade-in support</b><small>Semakan kereta lama boleh dibuat semasa visit.</small></div>
          <div><b>Finance guidance</b><small>Kami bantu shortlist pakej loan dan insurance.</small></div>
        </div>
        <div class="event-detail-actions compact">
          <a href="${window.IASBSite.whatsappUrl(viewingMessage)}" target="_blank" rel="noopener">Book viewing slot</a>
          <a class="outline" href="contact.html">Visit HQ</a>
        </div>
      </article>
      <article class="event-action-card glass-card accent">
        <span>MAKE IT HAPPEN</span>
        <h3>Move cepat sebelum slot dan unit terbaik habis.</h3>
        <p>${safeText(cars.length ? `Sekarang ada ${cars.length} unit yang dipadankan terus dengan campaign ini.` : "Team kami boleh bantu pilih ready stock atau incoming unit yang paling ngam dengan bajet anda.")}</p>
        <div class="event-action-pills">
          <span>Event price enquiry</span>
          <span>Ready stock shortlist</span>
          <span>Loan eligibility check</span>
        </div>
        <div class="event-detail-actions compact">
          <a href="${window.IASBSite.whatsappUrl(mainMessage)}" data-lead-action="event_whatsapp_secondary" data-lead-label="${safeText(event.title)}" target="_blank" rel="noopener">Claim event offer</a>
          <a class="outline" href="inventory.html">Browse inventory</a>
        </div>
      </article>
    </section>`;
  }

  function renderCampaignCars(event, inventory) {
    const cars = campaignCars(event, inventory);
    if (!cars.length) return "";
    return `<div class="event-stock-strip event-animate">
      <div class="event-section-heading">
        <span>PARTICIPATING STOCK</span>
        <h3>Unit pilihan yang sedang join campaign ini.</h3>
      </div>
      <div>${cars.map(car => {
        const href = car.id ? `car.html?id=${encodeURIComponent(car.id)}` : "inventory.html";
        return `<a href="${href}" data-lead-action="event_stock_detail" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(`${car.brand} ${car.model}`)}">
          <span>${safeText(car.status || "AVAILABLE")}</span>
          <b>${safeText(car.brand)} ${safeText(car.model)}</b>
          <small>${safeText([car.year, car.grade, car.variant].filter(Boolean).join(" · ") || car.type || "Recond")}</small>
          <strong>${money(car.price)}</strong>
        </a>`;
      }).join("")}</div>
    </div>`;
  }

  function fallback() {
    root.innerHTML = `<div class="inventory-state">
      <span>EVENT UPDATE</span>
      <h2>Belum ada event aktif buat masa ini.</h2>
      <p>Untuk ready stock terkini atau promo semasa, WhatsApp team Izuwan Automobile.</p>
      <a href="${window.IASBSite.whatsappUrl("[Events Page] Hai, saya nak tahu promo atau ready stock terkini Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Izuwan Automobile</a>
    </div>`;
  }

  function render(events, inventory = []) {
    const liveEvents = (events || []).filter(isLive);
    if (!liveEvents.length) return fallback();

    root.innerHTML = liveEvents.map(event => {
      const message = event.cta_message || `[Events Page] Hai, saya nak tahu info lanjut tentang ${event.title}.`;
      const dateText = [formatDate(event.start_date), formatDate(event.end_date)].filter(Boolean).join(" - ");
      return `<section class="event-stage">
        <article class="event-detail-card event-animate">
          <div class="event-detail-media">${event.banner_url
            ? `<img src="${safeText(event.banner_url)}" alt="${safeText(event.title)}">`
            : `<span>IA</span>`}</div>
          <div class="event-detail-copy">
            <div class="event-hero-topline">
              <small>${safeText(event.kicker || "SPECIAL EVENT")}</small>
              <div class="event-live-pill glass-card">${safeText(countdownText(event))}</div>
            </div>
            <h2>${safeText(event.title)}</h2>
            <div class="event-description">${formatEventDescription(event.description || event.subtitle || "Event khas Izuwan Automobile sedang berlangsung.")}</div>
            <div class="event-detail-meta">
              ${dateText ? `<span>${safeText(dateText)}</span>` : ""}
              ${event.location ? `<span>${safeText(event.location)}</span>` : ""}
              ${event.campaign_tag ? `<span>${safeText(event.campaign_tag)}</span>` : ""}
              <span>Selected ready stock</span>
            </div>
            <div class="event-benefits">
              <span>Ready stock clearance</span>
              <span>Viewing slot at HQ</span>
              <span>Loan & insurance assistance</span>
            </div>
            <div class="event-detail-actions">
              <a href="${window.IASBSite.whatsappUrl(message)}" data-lead-action="event_whatsapp" data-lead-label="${safeText(event.title)}" target="_blank" rel="noopener">${safeText(event.cta_label || "WhatsApp untuk info lanjut")} ↗</a>
              <a class="outline" href="inventory.html">View ready stock</a>
            </div>
          </div>
        </article>
        ${renderEventStats(event, inventory)}
        ${renderHighlights(event, inventory)}
        ${renderCampaignCars(event, inventory)}
        ${renderActionDeck(event, inventory)}
      </section>`;
    }).join("");

    animatePanels();
  }

  window.addEventListener("iasb:data", event => render(event.detail.events || [], event.detail.inventory || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
