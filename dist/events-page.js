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

  function fallback() {
    root.innerHTML = `<div class="inventory-state">
      <span>EVENT UPDATE</span>
      <h2>Belum ada event aktif buat masa ini.</h2>
      <p>Untuk ready stock terkini atau promo semasa, WhatsApp team Izuwan Automobile.</p>
      <a href="${window.IASBSite.whatsappUrl("Hai, saya nak tahu promo atau ready stock terkini Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Izuwan Automobile</a>
    </div>`;
  }

  function render(events) {
    const liveEvents = (events || []).filter(isLive);
    if (!liveEvents.length) return fallback();
    root.innerHTML = liveEvents.map(event => {
      const message = event.cta_message || `Hai, saya nak tahu info lanjut tentang ${event.title}.`;
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
            ${dateText ? `<span>${safeText(dateText)}</span>` : ""}
            ${event.location ? `<span>${safeText(event.location)}</span>` : ""}
          </div>
          <div class="event-detail-actions">
            <a href="${window.IASBSite.whatsappUrl(message)}" target="_blank" rel="noopener">${safeText(event.cta_label || "WhatsApp untuk info lanjut")} ↗</a>
            <a class="outline" href="inventory.html">View ready stock</a>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  window.addEventListener("iasb:data", event => render(event.detail.events || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
