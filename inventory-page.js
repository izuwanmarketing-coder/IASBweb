/* ============================================================
   IZUWAN — inventory page logic v2 (inventory-page.js)
   Spec §4.2: facet chips with counts, monthly-budget filter,
   live result count, load-more, honest sold/incoming states,
   recovery empty state. Cards come from vehicle-card.js.
   ============================================================ */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fallbackCars = [...(window.inventoryData || [])].map((car, index) => ({
    ...car,
    _sourceIndex: index,
    _fallbackIndex: index
  }));
  let cars = [];
  let activeType = "all";
  let searchTerm = "";
  let brand = "all";
  let locationName = "all";
  let status = "all";
  let budget = "all";
  let sortMode = "latest";
  let visibleLimit = 12;
  let activeGallery = null;
  let activePhoto = 0;

  const TYPES = ["all", "MPV", "SUV", "Sedan", "Hatchback", "Performance", "Coupe", "Convertible", "Mini MPV"];
  const TYPE_LABELS = { all: "Semua", "Mini MPV": "Mini MPV" };
  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const hasValidPrice = window.IASBCards?.hasValidPrice || (value => Number(value) >= 10000);
  const monthlyEstimate = value => window.IASBSite?.monthlyEstimate(value)
    ?? Math.round((((Number(value) || 0) * 0.9) * (1 + (0.032 * 9))) / (9 * 12));

  const identityFor = car => car?._galleryKey
    || (car?.id ? `id:${car.id}` : `source:${car?._fallbackIndex ?? car?._sourceIndex ?? "unknown"}`);

  function fallbackPhotoFor(car) {
    /* Photo pack is keyed by inventory order; sheet rows without managed
       photos show the honest placeholder (spec §3.1 rule 1). */
    return null;
  }

  function photoFor(car) {
    const managedPhotos = [car.image_url, ...(car.gallery_urls || [])].filter(Boolean);
    if (managedPhotos.length) {
      const uniquePhotos = [...new Set(managedPhotos)];
      return { photos: uniquePhotos.map(src => ({ src })), folder: uniquePhotos[0] };
    }
    return null;
  }

  function renderTypeChips() {
    const container = document.querySelector(".filters.inventory-types");
    if (!container) return;
    const counts = {};
    cars.forEach(car => {
      const type = String(car.type || "Other");
      counts[type] = (counts[type] || 0) + 1;
    });
    const match = (type, car) => {
      if (type === "all") return true;
      if (type === "Performance") return /amg|type r|gr86|performance|coupe/i.test(`${car.brand} ${car.model} ${car.variant} ${car.type}`);
      return car.type === type;
    };
    const isPerformance = car => match("Performance", car);
    if (cars.some(isPerformance)) counts["Performance"] = cars.filter(isPerformance).length;
    const present = TYPES.filter(type => type === "all" || counts[type]);
    container.innerHTML = present.map(type => {
      const count = type === "all" ? cars.length : cars.filter(car => match(type, car)).length;
      const label = TYPE_LABELS[type] || type;
      return `<button class="filter${activeType === type ? " active" : ""}" type="button" data-type="${type}" aria-pressed="${activeType === type}">${label}<span class="filter-count">${count}</span></button>`;
    }).join("");
    container.querySelectorAll("[data-type]").forEach(button => {
      button.addEventListener("click", () => {
        visibleLimit = 12;
        activeType = button.dataset.type;
        container.querySelectorAll("[data-type]").forEach(item => {
          item.classList.toggle("active", item === button);
          item.setAttribute("aria-pressed", String(item === button));
        });
        render();
      });
    });
  }

  function typeMatcher(car) {
    if (activeType === "all") return true;
    if (activeType === "Performance") return /amg|type r|gr86|performance|coupe/i.test(`${car.brand} ${car.model} ${car.variant} ${car.type}`);
    return car.type === activeType;
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

  function whatsappRecovery() {
    return window.IASBSite.whatsappUrl("Hai, saya ingin semak senarai ready stock terkini Izuwan Automobile.");
  }

  function showState(kind, title, body, cta) {
    $("inventoryStats").classList.add("hidden");
    $("inventorySummary").textContent = kind === "error" ? "Inventory tidak dapat dimuatkan" : "Ready stock terkini";
    $("carGrid").innerHTML = `<div class="inventory-state">
      <span>${kind === "error" ? "CONNECTION NOTICE" : "READY STOCK UPDATE"}</span>
      <h2>${window.IASBCards.safeText(title)}</h2>
      <p>${window.IASBCards.safeText(body)}</p>
      <a href="${whatsappRecovery()}" target="_blank" rel="noopener">${window.IASBCards.safeText(cta)}</a>
    </div>`;
  }

  function sorted(list) {
    return [...list].sort((a, b) => {
      if (sortMode === "price-low") return (hasValidPrice(a.price) ? Number(a.price) : Number.MAX_SAFE_INTEGER) - (hasValidPrice(b.price) ? Number(b.price) : Number.MAX_SAFE_INTEGER);
      if (sortMode === "price-high") return (hasValidPrice(b.price) ? Number(b.price) : -1) - (hasValidPrice(a.price) ? Number(a.price) : -1);
      if (sortMode === "monthly-low") return (hasValidPrice(a.price) ? monthlyEstimate(a.price) : Number.MAX_SAFE_INTEGER) - (hasValidPrice(b.price) ? monthlyEstimate(b.price) : Number.MAX_SAFE_INTEGER);
      if (sortMode === "mileage-low") return (Number(a.mileage) || Number.MAX_SAFE_INTEGER) - (Number(b.mileage) || Number.MAX_SAFE_INTEGER);
      const dateDifference = (Date.parse(b.created_at || b.updated_at || "") || 0) - (Date.parse(a.created_at || a.updated_at || "") || 0);
      return dateDifference || Number(a._sourceIndex || 0) - Number(b._sourceIndex || 0);
    });
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
      .filter(typeMatcher)
      .filter(car => brand === "all" || car.brand === brand)
      .filter(car => locationName === "all" || car.location === locationName)
      .filter(car => status === "all" || car.status === status)
      .filter(car => budget === "all" || (hasValidPrice(car.price) && monthlyEstimate(car.price) <= Number(budget)))
      .filter(car => !query || [car.brand, car.model, car.year, car.grade, car.variant, car.exterior_color, car.interior_color, car.type, car.location, car.status]
        .join(" ").toLowerCase().includes(query)));

    renderStats(filtered);
    const activeFilterCount = [brand, locationName, status, budget].filter(value => value !== "all").length + (sortMode !== "latest" ? 1 : 0);
    $("filterSummaryLabel").textContent = activeFilterCount ? `Filters (${activeFilterCount})` : "More filters";
    $("filterSummaryHint").textContent = activeFilterCount ? "Tap untuk ubah atau reset" : "Brand, lokasi, status, bajet & susunan";
    const assumptions = window.IASBSite?.financeAssumptions() || { depositPct: 10, years: 9, rate: 3.2 };
    $("inventorySummary").textContent = `${filtered.length} pilihan ditemui. Anggaran ansuran menggunakan deposit ${assumptions.depositPct}%, ${assumptions.years} tahun dan kadar ${assumptions.rate}% setahun.`;
    $("financeAssumption").textContent = `Anggaran ansuran berdasarkan deposit ${assumptions.depositPct}%, ${assumptions.years} tahun dan kadar ${assumptions.rate}% setahun. Tertakluk kepada kelulusan bank.`;
    const sortLabels = { latest: "Ketibaan terbaru", "price-low": "Harga terendah", "price-high": "Harga tertinggi", "monthly-low": "Ansuran terendah", "mileage-low": "Mileage terendah" };
    const chips = [
      activeType !== "all" ? ["type", activeType === "Performance" ? "Performance" : activeType] : null,
      searchTerm.trim() ? ["search", `Carian: ${searchTerm.trim()}`] : null,
      brand !== "all" ? ["brand", brand] : null,
      locationName !== "all" ? ["location", locationName] : null,
      status !== "all" ? ["status", window.IASBSite.statusLabel(status)] : null,
      budget !== "all" ? ["budget", `Bawah RM${Number(budget).toLocaleString("en-MY")}/bulan`] : null,
      sortMode !== "latest" ? ["sort", sortLabels[sortMode] || sortMode] : null
    ].filter(Boolean);
    $("activeFilterChips").innerHTML = chips.map(([key, label]) => `<button type="button" data-clear-filter="${key}" aria-label="Buang filter ${window.IASBCards.safeText(label)}">${window.IASBCards.safeText(label)} <span aria-hidden="true">×</span></button>`).join("");
    $("activeFilterChips").classList.toggle("hidden", !chips.length);
    const displayed = filtered.slice(0, visibleLimit);
    const renderer = window.IASBCards.renderCard;
    $("carGrid").innerHTML = filtered.length
      ? displayed.map(car => renderer(car, { hrefBase: "car.html" })).join("") + (filtered.length > displayed.length
        ? `<button class="inventory-load-more" type="button" data-load-more>Tunjuk lagi ${Math.min(12, filtered.length - displayed.length)} unit</button>`
        : "")
      : `<div class="empty-state">
          <strong>Tiada stok sepadan</strong>
          <span>Filter ini yang buat hasil kosong: ${window.IASBCards.safeText(chips.map(([, label]) => label).join(", ") || "—")}. Cuba buang filter, atau beritahu kami spesifikasi yang anda cari.</span>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
            <button type="button" class="filter" data-clear-all>Buang semua filter</button>
            <a class="filter" style="background:var(--accent);border-color:var(--accent);color:#fff;text-decoration:none" href="${window.IASBSite.whatsappUrl("[Inventory Page] Hai, saya cari kereta dengan spesifikasi tertentu. Boleh bantu semak?")}" target="_blank" rel="noopener">Tanya advisor</a>
            <a class="filter" style="text-decoration:none" href="find-car.html">Find My Car</a>
          </div>
        </div>`;

    document.querySelectorAll("[data-stock-enquiry]").forEach(link => {
      const car = displayed.find(item => String(item.id || "") === String(link.dataset.carId || "")) || displayed[0];
      if (!car) return;
      link.href = window.IASBSite.whatsappUrl(link.dataset.message || window.IASBCards.enquiryMessage(car));
    });
  }

  function openGallery(carKey) {
    const car = cars.find(item => identityFor(item) === carKey);
    const gallery = car ? photoFor(car) : null;
    if (!car || !gallery?.photos?.length) return;
    activeGallery = { car, gallery, trigger: document.activeElement };
    activePhoto = 0;
    updateGallery();
    $("photoDialog").showModal();
  }

  function updateGallery(delta = 0) {
    if (!activeGallery) return;
    const photos = activeGallery.gallery.photos;
    activePhoto = (activePhoto + delta + photos.length) % photos.length;
    $("photoLarge").src = photos[activePhoto].src;
    $("photoLarge").alt = `${activeGallery.car.brand} ${activeGallery.car.model}, gambar ${activePhoto + 1} daripada ${photos.length}`;
    $("photoTitle").textContent = `${activeGallery.car.brand} ${activeGallery.car.model}`;
    $("photoCounter").textContent = `${activePhoto + 1} / ${photos.length}`;
    $("photoPrev").setAttribute("aria-label", `Gambar sebelumnya. Gambar ${activePhoto + 1} daripada ${photos.length}`);
    $("photoNext").setAttribute("aria-label", `Gambar seterusnya. Gambar ${activePhoto + 1} daripada ${photos.length}`);
    $("photoDriveLink").href = activeGallery.gallery.folder;
  }

  function bindStaticControls() {
    $("stockSearch").addEventListener("input", event => { visibleLimit = 12; searchTerm = event.target.value; render(); });
    $("brandFilter").addEventListener("change", event => { visibleLimit = 12; brand = event.target.value; render(); });
    $("locationFilter").addEventListener("change", event => { visibleLimit = 12; locationName = event.target.value; render(); });
    $("statusFilter").addEventListener("change", event => { visibleLimit = 12; status = event.target.value; render(); });
    $("budgetFilter").addEventListener("change", event => { visibleLimit = 12; budget = event.target.value; render(); });
    $("sortFilter").addEventListener("change", event => { visibleLimit = 12; sortMode = event.target.value; render(); });
    $("clearFilters").addEventListener("click", resetAll);
    $("activeFilterChips").addEventListener("click", event => {
      const button = event.target.closest("[data-clear-filter]");
      if (!button) return;
      const key = button.dataset.clearFilter;
      if (key === "type") { activeType = "all"; renderTypeChips(); }
      if (key === "search") { searchTerm = ""; $("stockSearch").value = ""; }
      if (key === "brand") { brand = "all"; $("brandFilter").value = "all"; }
      if (key === "location") { locationName = "all"; $("locationFilter").value = "all"; }
      if (key === "status") { status = "all"; $("statusFilter").value = "all"; }
      if (key === "budget") { budget = "all"; $("budgetFilter").value = "all"; }
      if (key === "sort") { sortMode = "latest"; $("sortFilter").value = "latest"; }
      visibleLimit = 12;
      render();
    });
    document.addEventListener("click", event => {
      if (event.target.closest("[data-clear-all]")) { resetAll(); return; }
      const filters = document.querySelector(".inventory-more-filters");
      if (filters?.open && !filters.contains(event.target)) filters.removeAttribute("open");
    });
    document.querySelector(".inventory-more-filters")?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.currentTarget.removeAttribute("open");
        event.currentTarget.querySelector("summary")?.focus();
      }
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
    $("photoDialog").addEventListener("close", () => activeGallery?.trigger?.focus());
    $("photoDialog").addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") updateGallery(-1);
      if (event.key === "ArrowRight") updateGallery(1);
    });
  }

  function resetAll() {
    searchTerm = "";
    activeType = brand = locationName = status = budget = "all";
    $("stockSearch").value = "";
    ["brandFilter", "locationFilter", "statusFilter", "budgetFilter"].forEach(id => $(id).value = "all");
    sortMode = "latest";
    visibleLimit = 12;
    $("sortFilter").value = "latest";
    renderTypeChips();
    render();
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

  function initialize(nextCars, source) {
    cars = (nextCars || []).map((car, index) => ({
      ...car,
      _sourceIndex: car._sourceIndex ?? index,
      _galleryKey: car.id ? `id:${car.id}` : `source:${car._fallbackIndex ?? index}`
    }));
    populateSelect("brandFilter", cars.map(car => car.brand), "Semua brand");
    populateSelect("locationFilter", cars.map(car => car.location), "Semua lokasi");
    renderTypeChips();
    render();
    document.body.dataset.inventorySource = source;
  }

  bindStaticControls();
  window.addEventListener("iasb:data", event => {
    initialize(event.detail.inventory || [], event.detail.inventorySource || "managed");
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
