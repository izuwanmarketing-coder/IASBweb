(function () {
  const root = document.getElementById("carDetailRoot");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const requestedId = params.get("id");
  const requestedSource = params.get("source");
  const fallbackCars = [...(window.inventoryData || [])].map((car, index) => ({ ...car, _sourceIndex: index }));
  const fallbackPhotoMap = new Map(
    fallbackCars.map((car, index) => [`${car.brand}|${car.model}|${car.variant}`.toLowerCase(), window.carPhotoData?.[index] || null])
  );

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const mileage = value => Number(value) > 0 ? `${Math.round(Number(value)).toLocaleString("en-MY")} km` : "Upon request";

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function keyFor(car) {
    return `${car.brand}|${car.model}|${car.variant}`.toLowerCase();
  }

  function photoFor(car) {
    if (car.image_url) return car.image_url;
    const gallery = fallbackPhotoMap.get(keyFor(car));
    return gallery?.photos?.[0]?.src || "";
  }

  function findCar(managedCars) {
    const list = (managedCars || []).map((car, index) => ({ ...car, _sourceIndex: car._sourceIndex ?? index }));
    if (requestedId) {
      const managed = list.find(car => String(car.id) === String(requestedId));
      if (managed) return managed;
    }
    if (requestedSource !== null && requestedSource !== "") {
      return fallbackCars[Number(requestedSource)] || list[Number(requestedSource)] || null;
    }
    return list[0] || fallbackCars[0] || null;
  }

  function spec(label, value) {
    return `<div><span>${safeText(label)}</span><strong>${safeText(value || "Upon request")}</strong></div>`;
  }

  function notFound() {
    root.innerHTML = `<div class="inventory-state">
      <span>STOCK UPDATE</span>
      <h2>Unit ini mungkin sudah dikemaskini.</h2>
      <p>Inventory bergerak cepat. WhatsApp team Izuwan untuk confirm availability dan pilihan yang paling latest.</p>
      <a href="${window.IASBSite.whatsappUrl("[Car Detail Page] Hai, saya nak semak availability ready stock terkini Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Izuwan Automobile</a>
    </div>`;
  }

  function render(car) {
    if (!car) return notFound();
    const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "Japan reconditioned unit";
    const title = `${car.brand || ""} ${car.model || ""}`.trim() || "Izuwan ready stock";
    const image = photoFor(car);
    const whatsappMessage = `[Car Detail Page] Hai, saya berminat dengan ${title}${detailLine ? ` (${detailLine})` : ""}. Boleh share details dan availability terkini?`;
    document.title = `${title} | Izuwan Automobile`;
    document.getElementById("breadcrumbCar").textContent = title;

    root.innerHTML = `<section class="car-detail-shell">
      <div class="car-detail-media">${image
        ? `<img src="${safeText(image)}" alt="${safeText(title)}">`
        : `<div class="car-detail-placeholder"><span>IA</span><p>Gambar akan dikemaskini</p></div>`}
      </div>
      <article class="car-detail-panel">
        <small>${safeText(car.status || "AVAILABLE")} · ${safeText(car.location || "Izuwan Automobile")}</small>
        <h1>${safeText(title)}</h1>
        <p>${safeText(detailLine)}</p>
        <div class="car-detail-price"><span>Estimated selling price</span><strong>${money(car.price)}</strong></div>
        <div class="car-spec-grid">
          ${spec("Year", car.year)}
          ${spec("Grade", car.grade || car.variant)}
          ${spec("Variant", car.variant || car.type)}
          ${spec("Mileage", mileage(car.mileage))}
          ${spec("Location", car.location || "HQ / showroom")}
          ${spec("Unit", `${Number(car.units) || 1} available`)}
        </div>
        <div class="car-detail-actions">
          <a href="${window.IASBSite.whatsappUrl(whatsappMessage)}" target="_blank" rel="noopener">WhatsApp enquiry</a>
          <a class="outline" href="calculator.html?price=${Number(car.price) || 0}&car=${encodeURIComponent(`${title} - ${detailLine}`)}">Kira ansuran</a>
          <a class="ghost" href="inventory.html">Back to inventory</a>
        </div>
      </article>
    </section>
    <section class="car-confidence-strip">
      <article><strong>Auction report</strong><span>Ask advisor untuk semakan report jika available.</span></article>
      <article><strong>Loan & insurance</strong><span>Team Izuwan boleh bantu proses pembiayaan dan insurance.</span></article>
      <article><strong>HQ Taman Wahyu</strong><span>Datang tengok unit atau booking viewing slot.</span></article>
    </section>`;
  }

  window.addEventListener("iasb:data", event => render(findCar(event.detail.inventory || [])));
  window.addEventListener("iasb:error", () => render(findCar(fallbackCars)));
  if (!window.IASBData?.configured) window.setTimeout(() => render(findCar(fallbackCars)), 120);
})();
