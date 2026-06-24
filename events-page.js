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
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
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

  function campaignCars(event, inventory) {
    const tag = String(event.campaign_tag || event.title || "").trim().toLowerCase();
    if (!tag) return [];
    return (inventory || []).filter(car => String(car.campaign_tag || "").trim().toLowerCase() === tag).slice(0, 8);
  }

  function renderCampaignCars(event, inventory) {
    const cars = campaignCars(event, inventory);
    if (!cars.length) return "";
    return `<div class="event-stock-strip">
      <h3>Participating stock</h3>
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
      const dateText = [formatDate(event.start_date), formatDate(event.end_date)].filter(Boolean).join(" – ");
      return `<article class="event-detail-card">
        <div class="event-detail-media">${event.banner_url
          ? `<img src="${safeText(event.banner_url)}" alt="${safeText(event.title)}">`
          : `<span>IA</span>`}</div>
        <div class="event-detail-copy">
          <small>${safeText(event.kicker || "SPECIAL EVENT")}</small>
          <h2>${safeText(event.title)}</h2>
          <p>${safeText(event.description || event.subtitle || "Event khas Izuwan Automobile sedang berlangsung.")}</p>
          <div class="event-detail-meta">
            <span>${safeText(countdownText(event))}</span>
            ${dateText ? `<span>${safeText(dateText)}</span>` : ""}
            ${event.location ? `<span>${safeText(event.location)}</span>` : ""}
            ${event.campaign_tag ? `<span>${safeText(event.campaign_tag)}</span>` : ""}
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
          ${renderCampaignCars(event, inventory)}
        </div>
      </article>`;
    }).join("");
  }

  window.addEventListener("iasb:data", event => render(event.detail.events || [], event.detail.inventory || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
