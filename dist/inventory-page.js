(function () {
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

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const mileage = value => Number(value) > 0 ? `${Math.round(Number(value)).toLocaleString("en-MY")} km` : "Upon request";
  const hasValidSellingPrice = value => Number(value) >= 10000;
  const monthlyEstimate = value => window.IASBSite?.monthlyEstimate(value)
    ?? Math.round((((Number(value) || 0) * 0.9) * (1 + (0.032 * 9))) / (9 * 12));
  const statusLabel = value => window.IASBSite?.statusLabel(value) || String(value || "Ready Stock");
  const fallbackPhotoMap = new Map(
    fallbackCars.map((car, index) => [index, window.carPhotoData?.[index] || null])
  );
  const fallbackCandidateMap = fallbackCars.reduce((map, car, index) => {
    const key = `${car.brand}|${car.model}|${car.variant}`.toLowerCase();
    map.set(key, [...(map.get(key) || []), index]);
    return map;
  }, new Map());

  const identityFor = car => car?._galleryKey
    || (car?.id ? `id:${car.id}` : `source:${car?._fallbackIndex ?? car?._sourceIndex ?? "unknown"}`);

  function fallbackIndexFor(car) {
    if (Number.isInteger(car._fallbackIndex)) return car._fallbackIndex;
    const key = `${car.brand}|${car.model}|${car.variant}`.toLowerCase();
    const candidates = fallbackCandidateMap.get(key) || [];
    if (candidates.length <= 1) return candidates[0] ?? null;
    const normalized = value => String(value ?? "").trim().toLowerCase();
    const scored = candidates.map(index => {
      const candidate = fallbackCars[index];
      let score = 0;
      if (Number(car.price) > 0 && Number(car.price) === Number(candidate.price)) score += 8;
      if (normalized(car.location) && normalized(car.location) === normalized(candidate.location)) score += 4;
      if (normalized(car.status) && normalized(car.status) === normalized(candidate.status)) score += 2;
      if (Number(car.units) > 0 && Number(car.units) === Number(candidate.units)) score += 1;
      return { index, score };
    });
    const bestScore = Math.max(...scored.map(item => item.score));
    const winners = scored.filter(item => item.score === bestScore);
    return winners.length === 1 ? winners[0].index : null;
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function photoFor(car) {
    const managedPhotos = [car.image_url, ...(car.gallery_urls || [])].filter(Boolean);
    if (managedPhotos.length) {
      const uniquePhotos = [...new Set(managedPhotos)];
      return { photos: uniquePhotos.map(src => ({ src })), folder: uniquePhotos[0] };
    }
    const fallbackIndex = fallbackIndexFor(car);
    if (fallbackIndex !== null) return fallbackPhotoMap.get(fallbackIndex) || null;
    return null;
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
      if (sortMode === "price-low") return (hasValidSellingPrice(a.price) ? Number(a.price) : Number.MAX_SAFE_INTEGER) - (hasValidSellingPrice(b.price) ? Number(b.price) : Number.MAX_SAFE_INTEGER);
      if (sortMode === "price-high") return (hasValidSellingPrice(b.price) ? Number(b.price) : -1) - (hasValidSellingPrice(a.price) ? Number(a.price) : -1);
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
      ? `<button class="inventory-photo" type="button" data-car-key="${encodeURIComponent(identityFor(car))}">
          <img loading="lazy" src="${safeText(gallery.photos[0].src)}" alt="${safeText(`${car.brand} ${car.model}`)}">
          <span>${gallery.photos.length} gambar</span>
        </button>`
      : `<div class="inventory-photo inventory-photo-empty"><span>Gambar akan datang</span></div>`;
    const badges = [car.campaign_tag, car.marketing_label, car.is_hot ? "Hot pick" : "", car.auction_report ? "Auction report" : "", car.mileage_verified ? "Mileage verified" : ""].filter(Boolean);
    const validPrice = hasValidSellingPrice(car.price);

    return `<article class="inventory-card">
      ${media}
      <div class="inventory-card-body">
        ${badges.length ? `<div class="stock-badges">${badges.map(badge => `<span>${safeText(badge)}</span>`).join("")}</div>` : ""}
        <div class="inventory-meta">
          <span>${safeText(car.brand)} / ${safeText(car.type || "Recond")}</span>
          <b class="stock-status">${safeText(statusLabel(car.status))}</b>
        </div>
        <h2><a class="inventory-title-link" href="${detailHref}">${safeText(car.brand)} ${safeText(car.model)}</a></h2>
        <p>${safeText(detailLine)}</p>
        <div class="inventory-spec-grid">
          <span><b>Year</b>${safeText(car.year || "Upon request")}</span>
          <span><b>Grade</b>${safeText(car.grade || car.variant || "Upon request")}</span>
          <span><b>Mileage</b>${safeText(mileage(car.mileage))}</span>
          <span><b>Location</b>${safeText(car.location || "Izuwan Automobile")}</span>
        </div>
        <div class="inventory-price">
          <div><strong>${validPrice ? money(car.price) : "Harga perlu disahkan"}</strong><span>${validPrice ? `${money(monthlyEstimate(car.price))}/bulan anggaran · ${Number(car.units) || 1} unit` : "WhatsApp advisor untuk harga terkini"}</span></div>
          ${validPrice ? `<a class="inventory-calc-link" href="calculator.html?price=${Number(car.price) || 0}&car=${encodedLabel}" data-lead-action="inventory_calculator" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(`${car.brand} ${car.model}`)}">Kira tepat →</a>` : ""}
        </div>
        <div class="inventory-actions">
          <a href="${detailHref}" data-lead-action="inventory_details" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(`${car.brand} ${car.model}`)}">Lihat kereta</a>
          <a class="outline" data-stock-enquiry data-lead-action="inventory_whatsapp" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(`${car.brand} ${car.model}`)}" href="#">WhatsApp</a>
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
      .filter(car => budget === "all" || (hasValidSellingPrice(car.price) && monthlyEstimate(car.price) <= Number(budget)))
      .filter(car => !query || [car.brand, car.model, car.year, car.grade, car.variant, car.exterior_color, car.interior_color, car.type, car.location, car.status]
        .join(" ").toLowerCase().includes(query)));

    renderStats(filtered);
    const activeFilterCount = [brand, locationName, status, budget].filter(value => value !== "all").length + (sortMode !== "latest" ? 1 : 0);
    $("filterSummaryLabel").textContent = activeFilterCount ? `Filters (${activeFilterCount})` : "More filters";
    $("filterSummaryHint").textContent = activeFilterCount ? "Tap untuk ubah atau reset" : "Brand, lokasi, status, bajet & susunan";
    const assumptions = window.IASBSite?.financeAssumptions() || { depositPct: 10, years: 9, rate: 3.2 };
    $("inventorySummary").textContent = `${filtered.length} pilihan ditemui. Anggaran ansuran menggunakan deposit ${assumptions.depositPct}%, ${assumptions.years} tahun dan kadar ${assumptions.rate}% setahun.`;
    $("financeAssumption").textContent = `Anggaran ansuran berdasarkan deposit ${assumptions.depositPct}%, ${assumptions.years} tahun dan kadar ${assumptions.rate}% setahun. Tertakluk kepada kelulusan bank.`;
    const chips = [
      activeType !== "all" ? ["type", activeType] : null,
      searchTerm.trim() ? ["search", `Carian: ${searchTerm.trim()}`] : null,
      brand !== "all" ? ["brand", brand] : null,
      locationName !== "all" ? ["location", locationName] : null,
      status !== "all" ? ["status", statusLabel(status)] : null,
      budget !== "all" ? ["budget", `Bawah RM${Number(budget).toLocaleString("en-MY")}/bulan`] : null,
      sortMode !== "latest" ? ["sort", $("sortFilter").selectedOptions[0].textContent] : null
    ].filter(Boolean);
    $("activeFilterChips").innerHTML = chips.map(([key, label]) => `<button type="button" data-clear-filter="${key}" aria-label="Buang filter ${safeText(label)}">${safeText(label)} <span aria-hidden="true">×</span></button>`).join("");
    $("activeFilterChips").classList.toggle("hidden", !chips.length);
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

  document.querySelectorAll("[data-type]").forEach(button => button.addEventListener("click", () => {
    visibleLimit = 12;
    activeType = button.dataset.type;
    document.querySelectorAll("[data-type]").forEach(item => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  }));
  $("stockSearch").addEventListener("input", event => { visibleLimit = 12; searchTerm = event.target.value; render(); });
  $("brandFilter").addEventListener("change", event => { visibleLimit = 12; brand = event.target.value; render(); });
  $("locationFilter").addEventListener("change", event => { visibleLimit = 12; locationName = event.target.value; render(); });
  $("statusFilter").addEventListener("change", event => { visibleLimit = 12; status = event.target.value; render(); });
  $("budgetFilter").addEventListener("change", event => { visibleLimit = 12; budget = event.target.value; render(); });
  $("sortFilter").addEventListener("change", event => { visibleLimit = 12; sortMode = event.target.value; render(); });
  $("clearFilters").addEventListener("click", () => {
    activeType = searchTerm = "";
    activeType = brand = locationName = status = budget = "all";
    $("stockSearch").value = "";
    ["brandFilter", "locationFilter", "statusFilter", "budgetFilter"].forEach(id => $(id).value = "all");
    sortMode = "latest";
    visibleLimit = 12;
    $("sortFilter").value = "latest";
    document.querySelectorAll("[data-type]").forEach(item => {
      const selected = item.dataset.type === "all";
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
  $("activeFilterChips").addEventListener("click", event => {
    const button = event.target.closest("[data-clear-filter]");
    if (!button) return;
    const key = button.dataset.clearFilter;
    if (key === "type") {
      activeType = "all";
      document.querySelectorAll("[data-type]").forEach(item => {
        const selected = item.dataset.type === "all";
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    }
    if (key === "search") { searchTerm = ""; $("stockSearch").value = ""; }
    if (key === "brand") { brand = "all"; $("brandFilter").value = "all"; }
    if (key === "location") { locationName = "all"; $("locationFilter").value = "all"; }
    if (key === "status") { status = "all"; $("statusFilter").value = "all"; }
    if (key === "budget") { budget = "all"; $("budgetFilter").value = "all"; }
    if (key === "sort") { sortMode = "latest"; $("sortFilter").value = "latest"; }
    visibleLimit = 12;
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
  $("photoDialog").addEventListener("close", () => activeGallery?.trigger?.focus());
  $("photoDialog").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") updateGallery(-1);
    if (event.key === "ArrowRight") updateGallery(1);
  });
  document.addEventListener("click", event => {
    const filters = document.querySelector(".inventory-more-filters");
    if (filters?.open && !filters.contains(event.target)) filters.removeAttribute("open");
  });
  document.querySelector(".inventory-more-filters")?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.currentTarget.removeAttribute("open");
      event.currentTarget.querySelector("summary")?.focus();
    }
  });

  function initialize(nextCars, source) {
    cars = (nextCars || []).map((car, index) => ({
      ...car,
      _sourceIndex: car._sourceIndex ?? index,
      _galleryKey: car.id
        ? `id:${car.id}`
        : Number.isInteger(car._fallbackIndex)
          ? `source:${car._fallbackIndex}`
          : `${source}:${index}`
    }));
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
  document.querySelectorAll("[data-type]").forEach(item => item.setAttribute("aria-pressed", String(item.classList.contains("active"))));
})();
