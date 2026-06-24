(function () {
  const grid = document.getElementById("featuredStockGrid");
  if (!grid) return;

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const mileage = value => Number(value) > 0 ? `${Math.round(Number(value)).toLocaleString("en-MY")} km` : "Mileage upon request";

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fallback() {
    grid.innerHTML = `<div class="featured-stock-fallback">
      <span>READY STOCK</span>
      <h3>Featured stock sedang dikemaskini.</h3>
      <p>Untuk senarai ready stock terkini, WhatsApp team Izuwan dan kami akan semak availability untuk anda.</p>
      <a href="${window.IASBSite.whatsappUrl("Hai, saya ingin semak ready stock featured Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Izuwan →</a>
    </div>`;
  }

  function render(cars) {
    const list = cars || [];
    const featured = list.filter(car => car.is_featured);
    const displayCars = (featured.length ? featured : list).slice(0, 6);
    if (!displayCars.length) return fallback();

    grid.innerHTML = displayCars.map(car => {
      const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "Maklumat unit";
      const message = `Hai, saya berminat dengan featured stock ${car.brand} ${car.model} (${detailLine}). Masih available?`;
      return `<article class="featured-stock-card">
        <div class="featured-stock-photo">${car.image_url
          ? `<img loading="lazy" src="${safeText(car.image_url)}" alt="${safeText(`${car.brand} ${car.model}`)}">`
          : `<span>${safeText(car.brand || "IA")}</span>`}</div>
        <div class="featured-stock-copy">
          <small>${safeText(car.status || "AVAILABLE")} · ${safeText(car.location || "Izuwan Automobile")}</small>
          <h3>${safeText(car.brand)} ${safeText(car.model)}</h3>
          <p>${safeText(detailLine)}</p>
          <div class="featured-stock-specs">
            <span>${safeText(car.type || "Recond")}</span>
            <span>${safeText(mileage(car.mileage))}</span>
          </div>
          <div class="featured-stock-bottom">
            <strong>${money(car.price)}</strong>
            <a href="${window.IASBSite.whatsappUrl(message)}" target="_blank" rel="noopener">Enquire →</a>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  window.addEventListener("iasb:data", event => render(event.detail.inventory || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
