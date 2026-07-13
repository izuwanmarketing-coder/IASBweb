(function () {
  const grid = document.getElementById("deliveredGrid");
  if (!grid) return;

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-MY", { month: "short", year: "numeric" });
  }

  function fallback() {
    grid.innerHTML = "";
    document.getElementById("deliveredSection")?.classList.add("hidden");
  }

  function render(deliveries) {
    const list = (deliveries || []).filter(item => item.is_active !== false && item.photo_url).slice(0, 6);
    if (!list.length) return fallback();

    document.getElementById("deliveredSection")?.classList.remove("hidden");

    grid.innerHTML = list.map(item => {
      const meta = [item.location, formatDate(item.delivered_at)].filter(Boolean).join(" · ") || "Delivered by Izuwan";
      return `<article class="delivered-card">
        <div class="delivered-photo">${item.photo_url
          ? `<img loading="lazy" src="${safeText(item.photo_url)}" alt="${safeText(item.title || item.model || "Delivered by Izuwan")}">`
          : `<span>IA</span>`}</div>
        <div class="delivered-copy">
          <small>${safeText(meta)}</small>
          <h3>${safeText(item.title || "Delivered by Izuwan")}</h3>
          <b>${safeText(item.model || item.customer_name || "Izuwan customer")}</b>
          <p>${safeText(item.caption || "Thank you for trusting Izuwan Automobile.")}</p>
        </div>
      </article>`;
    }).join("");
  }

  window.addEventListener("iasb:data", event => render(event.detail.deliveries || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
