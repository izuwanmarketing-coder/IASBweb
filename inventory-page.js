(function () {
  const $ = id => document.getElementById(id);
  const fallbackCars = [...(window.inventoryData || [])].map((car, index) => ({ ...car, _sourceIndex: index }));
  let cars = [];
  let activeType = "all";
  let searchTerm = "";
  let brand = "all";
  let locationName = "all";
  let status = "all";
  let sortMode = "latest";
  let visibleLimit = 12;
  let activeGallery = null;
  let activePhoto = 0;

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const mileage = value => Number(value) > 0 ? `${Math.round(Number(value)).toLocaleString("en-MY")} km` : "Upon request";
  const keyFor = car => `${car.brand}|${car.model}|${car.variant}`.toLowerCase();
  const fallbackPhotoMap = new Map(
    fallbackCars.map((car, index) => [keyFor(car), window.carPhotoData?.[index] || null])
  );

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function photoFor(car) {
    if (car.image_url) return { photos: [{ src: car.image_url }], folder: car.image_url };
    return fallbackPhotoMap.get(keyFor(car)) || null;
  }

  function populateSelect(id, values, label) {
    const select = $(id);
    select.innerHTML = `<option value="all">${label}</option>`;
    [...new Set(values.filter(Boolean))].sort().forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function renderStats(filtered) {
    const stats = $("inventoryStats");
    if (!cars.length) {
      stats.classList.add("hidden");
      return;
    }
    stats.classList.remove("hidden");
    $("inventoryCount").textContent = filtered.length.toLocaleString("en-MY");
    $("unitCount").textContent = filtered.reduce((sum, car) => sum + (Number(car.units) || 1), 0).toLocaleString("en-MY");
    $("locationCount").textContent = new Set(cars.map(car => car.location).filter(Boolean)).size.toLocaleString("en-MY");
  }

  function showState(kind, title, body, cta) {
    $("inventoryStats").classList.add("hidden");
    $("inventorySummary").textContent = kind === "error" ? "Inventory tidak dapat dimuatkan" : "Ready stock terkini";
    $("carGrid").innerHTML = `<div class="inventory-state">
      <span>${kind === "error" ? "CONNECTION NOTICE" : "READY STOCK UPDATE"}</span>
      <h2>${safeText(title)}</h2>
      <p>${safeText(body)}</p>
      <a href="${window.IASBSite.whatsappUrl("Hai, saya ingin semak senarai ready stock terkini Izuwan Automobile.")}" target="_blank" rel="noopener">${safeText(cta)}</a>
    </div>`;
  }

  function sorted(list) {
    return [...list].sort((a, b) => {
      if (sortMode === "price-low") return Number(a.price) - Number(b.price);
      if (sortMode === "price-high") return Number(b.price) - Number(a.price);
      if (sortMode === "mileage-low") return (Number(a.mileage) || Number.MAX_SAFE_INTEGER) - (Number(b.mileage) || Number.MAX_SAFE_INTEGER);
      const dateDifference = (Date.parse(b.created_at || b.updated_at || "") || 0) - (Date.parse(a.created_at || a.updated_at || "") || 0);
      return dateDifference || Number(a._sourceIndex || 0) - Number(b._sourceIndex || 0);
    });
  }

  function renderCard(car) {
    const gallery = photoFor(car);
    const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "Maklumat unit";
    const encodedLabel = encodeURIComponent(`${car.brand} ${car.model} - ${detailLine}`);
    const detailHref = car.id
      ? `car.html?id=${encodeURIComponent(car.id)}`
      : `car.html?source=${encodeURIComponent(car._sourceIndex ?? "")}`;
    const media = gallery?.photos?.length
      ? `<button class="inventory-photo" type="button" data-car-key="${encodeURIComponent(keyFor(car))}">
          <img loading="lazy" src="${safeText(gallery.photos[0].src)}" alt="${safeText(`${car.brand} ${car.model}`)}">
          <span>${gallery.photos.length} gambar</span>
        </button>`
      : `<div class="inventory-photo inventory-photo-empty"><span>Gambar akan datang</span></div>`;

    return `<article class="inventory-card">
      ${media}
      <div class="inventory-card-body">
        <div class="inventory-meta">
          <span>${safeText(car.brand)} / ${safeText(car.type || "Recond")}</span>
          <b class="stock-status">${safeText(car.status || "AVAILABLE")}</b>
        </div>
        <h2>${safeText(car.brand)} ${safeText(car.model)}</h2>
        <p>${safeText(detailLine)}</p>
        <div class="inventory-spec-grid">
          <span><b>Year</b>${safeText(car.year || "Upon request")}</span>
          <span><b>Grade</b>${safeText(car.grade || car.variant || "Upon request")}</span>
          <span><b>Mileage</b>${safeText(mileage(car.mileage))}</span>
          <span><b>Location</b>${safeText(car.location || "Izuwan Automobile")}</span>
        </div>
        <div class="inventory-price">
          <strong>${money(car.price)}</strong>
          <span>${Number(car.units) || 1} unit</span>
        </div>
        <div class="inventory-actions">
          <a href="${detailHref}">Details</a>
          <a href="calculator.html?price=${Number(car.price) || 0}&car=${encodedLabel}">Kira ansuran</a>
          <a class="outline" data-stock-enquiry href="#">Tanya stok</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    if (!cars.length) {
      showState(
        "empty",
        "Inventory sedang dikemaskini",
        "Untuk senarai ready stock terkini, WhatsApp team Izuwan dan kami akan semak availability untuk anda.",
        "WhatsApp Izuwan Automobile"
      );
      return;
    }
    const query = searchTerm.trim().toLowerCase();
    const filtered = sorted(cars
      .filter(car => activeType === "all" || car.type === activeType)
      .filter(car => brand === "all" || car.brand === brand)
      .filter(car => locationName === "all" || car.location === locationName)
      .filter(car => status === "all" || car.status === status)
      .filter(car => !query || [car.brand, car.model, car.year, car.grade, car.variant, car.type, car.location, car.status]
        .join(" ").toLowerCase().includes(query)));

    renderStats(filtered);
    $("inventorySummary").textContent = `${filtered.length} pilihan ditemui`;
    const displayed = filtered.slice(0, visibleLimit);
    $("carGrid").innerHTML = filtered.length ? displayed.map(renderCard).join("") + (filtered.length > displayed.length
      ? `<button class="inventory-load-more" type="button" data-load-more>Tunjuk lagi ${Math.min(12, filtered.length - displayed.length)} unit</button>`
      : "") : `<div class="empty-state"><strong>Tiada stok sepadan</strong><span>Cuba buang filter atau gunakan carian lain.</span></div>`;

    document.querySelectorAll("[data-stock-enquiry]").forEach((link, index) => {
      const car = displayed[index];
      const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" / ");
      link.href = window.IASBSite.whatsappUrl(`[Inventory Page] Hai, saya berminat dengan ${car.brand} ${car.model}${detailLine ? ` (${detailLine})` : ""}. Masih available?`);
    });
  }

  function openGallery(carKey) {
    const car = cars.find(item => keyFor(item) === carKey);
    const gallery = car ? photoFor(car) : null;
    if (!car || !gallery?.photos?.length) return;
    activeGallery = { car, gallery };
    activePhoto = 0;
    updateGallery();
    $("photoDialog").showModal();
  }

  function updateGallery(delta = 0) {
    if (!activeGallery) return;
    const photos = activeGallery.gallery.photos;
    activePhoto = (activePhoto + delta + photos.length) % photos.length;
    $("photoLarge").src = photos[activePhoto].src;
    $("photoLarge").alt = `${activeGallery.car.brand} ${activeGallery.car.model}`;
    $("photoTitle").textContent = `${activeGallery.car.brand} ${activeGallery.car.model}`;
    $("photoCounter").textContent = `${activePhoto + 1} / ${photos.length}`;
    $("photoDriveLink").href = activeGallery.gallery.folder;
  }

  document.querySelectorAll("[data-type]").forEach(button => button.addEventListener("click", () => {
    visibleLimit = 12;
    activeType = button.dataset.type;
    document.querySelectorAll("[data-type]").forEach(item => item.classList.toggle("active", item === button));
    render();
  }));
  $("stockSearch").addEventListener("input", event => { visibleLimit = 12; searchTerm = event.target.value; render(); });
  $("brandFilter").addEventListener("change", event => { visibleLimit = 12; brand = event.target.value; render(); });
  $("locationFilter").addEventListener("change", event => { visibleLimit = 12; locationName = event.target.value; render(); });
  $("statusFilter").addEventListener("change", event => { visibleLimit = 12; status = event.target.value; render(); });
  $("sortFilter").addEventListener("change", event => { visibleLimit = 12; sortMode = event.target.value; render(); });
  $("clearFilters").addEventListener("click", () => {
    activeType = searchTerm = "";
    activeType = brand = locationName = status = "all";
    $("stockSearch").value = "";
    ["brandFilter", "locationFilter", "statusFilter"].forEach(id => $(id).value = "all");
    sortMode = "latest";
    visibleLimit = 12;
    $("sortFilter").value = "latest";
    document.querySelectorAll("[data-type]").forEach(item => item.classList.toggle("active", item.dataset.type === "all"));
    render();
  });
  $("carGrid").addEventListener("click", event => {
    if (event.target.closest("[data-load-more]")) {
      visibleLimit += 12;
      render();
      return;
    }
    const photo = event.target.closest("[data-car-key]");
    if (photo) openGallery(decodeURIComponent(photo.dataset.carKey));
  });
  $("photoClose").addEventListener("click", () => $("photoDialog").close());
  $("photoPrev").addEventListener("click", () => updateGallery(-1));
  $("photoNext").addEventListener("click", () => updateGallery(1));
  $("photoDialog").addEventListener("click", event => {
    if (event.target === $("photoDialog")) $("photoDialog").close();
  });

  function initialize(nextCars, source) {
    cars = (nextCars || []).map((car, index) => ({ ...car, _sourceIndex: car._sourceIndex ?? index }));
    populateSelect("brandFilter", cars.map(car => car.brand), "Semua brand");
    populateSelect("locationFilter", cars.map(car => car.location), "Semua lokasi");
    render();
    document.body.dataset.inventorySource = source;
  }

  window.addEventListener("iasb:data", event => {
    initialize(event.detail.inventory || [], "managed");
  });
  window.addEventListener("iasb:error", () => showState(
    "error",
    "Inventory tidak dapat dimuatkan buat sementara waktu",
    "WhatsApp team Izuwan untuk semakan ready stock dan availability terkini.",
    "WhatsApp Main Line"
  ));
  if (!window.IASBData?.configured) {
    window.setTimeout(() => initialize(fallbackCars, "built-in"), 180);
  }
})();
