(function () {
  const root = document.getElementById("carDetailRoot");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const requestedId = params.get("id");
  const requestedSource = params.get("source");
  const fallbackCars = [...(window.inventoryData || [])].map((car, index) => ({
    ...car,
    _sourceIndex: index,
    _fallbackIndex: index
  }));
  const fallbackPhotoMap = new Map(
    fallbackCars.map((car, index) => [index, window.carPhotoData?.[index] || null])
  );
  const fallbackCandidateMap = fallbackCars.reduce((map, car, index) => {
    const key = `${car.brand}|${car.model}|${car.variant}`.toLowerCase();
    map.set(key, [...(map.get(key) || []), index]);
    return map;
  }, new Map());

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const displayPrice = value => Number(value) >= 10000 ? money(value) : "Harga perlu disahkan";
  const mileage = value => Number(value) > 0 ? `${Math.round(Number(value)).toLocaleString("en-MY")} km` : "Upon request";
  const statusLabel = value => window.IASBSite?.statusLabel(value) || String(value || "Ready Stock");
  const statusClass = value => `status-${String(value || "available").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

  function formatUpdated(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ms-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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

  function photosFor(car) {
    const urls = [];
    if (car.image_url) urls.push(car.image_url);
    (car.gallery_urls || []).forEach(url => url && urls.push(url));
    const fallbackIndex = fallbackIndexFor(car);
    const fallback = fallbackIndex !== null
      ? fallbackPhotoMap.get(fallbackIndex)?.photos?.map(photo => photo.src) || []
      : [];
    fallback.forEach(url => url && urls.push(url));
    return [...new Set(urls)];
  }

  function findCar(managedCars) {
    const list = (managedCars || []).map((car, index) => ({ ...car, _sourceIndex: car._sourceIndex ?? index }));
    if (requestedId) {
      const managed = list.find(car => String(car.id) === String(requestedId));
      return { car: managed || null, allCars: list };
    }
    if (requestedSource !== null && requestedSource !== "") {
      const fallback = fallbackCars[Number(requestedSource)] || list[Number(requestedSource)] || null;
      return { car: fallback, allCars: list.length ? list : fallbackCars };
    }
    return { car: list[0] || fallbackCars[0] || null, allCars: list.length ? list : fallbackCars };
  }

  function spec(label, value) {
    return `<div><span>${safeText(label)}</span><strong>${safeText(value || "Upon request")}</strong></div>`;
  }

  function paymentEstimate(price, downpayment, years = 9, rate) {
    if (window.IASBSite?.monthlyEstimate) {
      const options = { years };
      if (downpayment !== undefined) options.downpayment = downpayment;
      if (rate !== undefined) options.rate = rate;
      return window.IASBSite.monthlyEstimate(price, options);
    }
    const deposit = downpayment === undefined ? Number(price || 0) * 0.1 : Number(downpayment || 0);
    const effectiveRate = rate === undefined ? 3.2 : Number(rate || 0);
    const principal = Math.max(0, Number(price || 0) - deposit);
    const interest = principal * (effectiveRate / 100) * Number(years || 0);
    return Math.round((principal + interest) / (Number(years || 1) * 12));
  }

  function notFound() {
    root.innerHTML = `<div class="inventory-state">
      <span>STOCK UPDATE</span>
      <h2>Unit ini mungkin sudah dikemaskini.</h2>
      <p>Inventory bergerak cepat. WhatsApp team Izuwan untuk confirm availability dan pilihan yang paling latest.</p>
      <a href="${window.IASBSite.whatsappUrl("[Car Detail Page] Hai, saya nak semak availability ready stock terkini Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Izuwan Automobile</a>
    </div>`;
  }

  function renderGallery(photos, title) {
    if (!photos.length) return `<div class="car-detail-placeholder"><span>IA</span><p>Gambar akan dikemaskini</p></div>`;
    return `<button class="car-main-image-button" id="openCarImage" type="button" aria-label="Buka galeri ${safeText(title)} dalam skrin penuh">
        <img class="car-main-image" id="carMainImage" src="${safeText(photos[0])}" alt="${safeText(title)}, gambar 1 daripada ${photos.length}">
        <span class="car-image-expand">Lihat gambar penuh <b>↗</b></span>
      </button>
      ${photos.length > 1 ? `<div class="car-thumbs" aria-label="Pilihan gambar">${photos.slice(0, 12).map((src, index) => `<button type="button" data-car-thumb-index="${index}" class="${index === 0 ? "active" : ""}" aria-label="Lihat gambar ${index + 1} daripada ${photos.length}"><img src="${safeText(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}`;
  }

  function renderBadges(car) {
    const badges = [
      car.campaign_tag,
      car.marketing_label,
      car.is_hot ? "Hot pick" : "",
      car.auction_report ? "Auction report available" : "",
      car.mileage_verified ? "Mileage verified" : "",
      car.grade_verified ? "Grade verified" : ""
    ].filter(Boolean);
    return badges.length ? `<div class="car-badges">${badges.map(badge => `<span>${safeText(badge)}</span>`).join("")}</div>` : "";
  }

  function renderSimilar(car, allCars) {
    const similar = (allCars || [])
      .filter(item => item && item !== car && (item.type === car.type || item.brand === car.brand))
      .slice(0, 3);
    if (!similar.length) return "";
    return `<section class="similar-stock">
      <div class="section-heading"><div><span class="eyebrow">SIMILAR READY STOCK</span><h2>You may also like.</h2></div><a class="section-link" href="inventory.html">View all →</a></div>
      <div class="similar-grid">${similar.map(item => {
        const href = item.id ? `car.html?id=${encodeURIComponent(item.id)}` : `car.html?source=${encodeURIComponent(item._sourceIndex ?? "")}`;
        return `<a href="${href}" class="similar-card">
          <span class="stock-status ${statusClass(item.status)}"><i aria-hidden="true"></i>${safeText(statusLabel(item.status))}</span>
          <h3>${safeText(item.brand)} ${safeText(item.model)}</h3>
          <p>${safeText([item.year, item.grade, item.variant].filter(Boolean).join(" · ") || item.type || "Recond")}</p>
          <strong>${displayPrice(item.price)}</strong>
        </a>`;
      }).join("")}</div>
    </section>`;
  }

  function render(car, allCars) {
    if (!car) return notFound();
    const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "Japan reconditioned unit";
    const title = `${car.brand || ""} ${car.model || ""}`.trim() || "Izuwan ready stock";
    const photos = photosFor(car);
    const validPrice = Number(car.price) >= 10000;
    const monthly = validPrice ? paymentEstimate(car.price) : 0;
    const assumptions = window.IASBSite?.financeAssumptions() || { depositPct: 10, years: 9, rate: 3.2 };
    const defaultDownpayment = Math.round((Number(car.price) || 0) * assumptions.depositPct / 100);
    const updated = formatUpdated(car.updated_at || car.created_at);
    const auctionEvidence = car.auction_report
      ? "Ditandakan tersedia untuk semakan bersama advisor."
      : "Status report belum dinyatakan; minta advisor sahkan.";
    const mileageEvidence = car.mileage_verified
      ? `${mileage(car.mileage)} ditandakan telah disahkan.`
      : `${mileage(car.mileage)} dipaparkan; minta pengesahan advisor.`;
    const gradeEvidence = car.grade_verified
      ? `${car.grade || "Grade unit"} ditandakan telah disahkan.`
      : "Grade dan keadaan akhir perlu disahkan bersama advisor.";
    const whatsappMessage = `[Car Detail Page] Hai, saya berminat dengan ${title}${detailLine ? ` (${detailLine})` : ""}. Boleh share details dan availability terkini?`;
    document.title = `${title} | Izuwan Automobile`;
    document.getElementById("breadcrumbCar").textContent = title;

    root.innerHTML = `<section class="car-detail-shell car-detail-v2">
      <div class="car-detail-media">${renderGallery(photos, title)}</div>
      <article class="car-detail-panel">
        <small class="car-status-line"><span class="stock-status ${statusClass(car.status)}"><i aria-hidden="true"></i>${safeText(statusLabel(car.status))}</span><span>${safeText(car.location || "Izuwan Automobile")}${updated ? ` · Dikemas kini ${safeText(updated)}` : ""}</span></small>
        <h1>${safeText(title)}</h1>
        <p>${safeText(car.description || detailLine)}</p>
        ${renderBadges(car)}
        <div class="car-detail-price"><span>Anggaran selling price</span><strong>${validPrice ? money(car.price) : "Harga perlu disahkan"}</strong>${validPrice ? `<em>± ${money(monthly)}/bulan · deposit ${assumptions.depositPct}% · ${assumptions.years} tahun · ${assumptions.rate}%</em>` : `<em>WhatsApp advisor untuk pengesahan harga terkini.</em>`}<small class="car-price-note">Harga OTR, insurance dan pembiayaan perlu disahkan bersama advisor.</small></div>
        <div class="car-spec-grid">
          ${spec("Year", car.year)}
          ${spec("Grade", car.grade || car.variant)}
          ${spec("Variant", car.variant || car.type)}
          ${spec("Mileage", mileage(car.mileage))}
          ${spec("Engine", car.engine || car.type)}
          ${spec("Transmission", car.transmission || "Automatic")}
          ${spec("Exterior", car.exterior_color)}
          ${spec("Location", car.location || "HQ / showroom")}
        </div>
        <div class="car-detail-actions">
          <a href="${window.IASBSite.whatsappUrl(whatsappMessage)}" data-lead-action="car_whatsapp" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(title)}" target="_blank" rel="noopener">WhatsApp enquiry</a>
          <a class="outline" href="#paymentEstimator">Estimate monthly</a>
          <a class="ghost" href="inventory.html">Back to inventory</a>
        </div>
      </article>
    </section>
    <section class="car-detail-tools">
      ${validPrice ? `<form class="payment-estimator" id="paymentEstimator">
        <span class="eyebrow">PAYMENT ESTIMATOR</span>
        <h2>Quick monthly estimate.</h2>
        <div class="form-grid">
          <label>Downpayment (RM)<input id="estimateDownpayment" type="number" min="0" value="${defaultDownpayment}"></label>
          <label>Tenure<select id="estimateYears"><option value="5">5 years</option><option value="7">7 years</option><option value="9" selected>9 years</option></select></label>
          <label>Interest (%)<input id="estimateRate" type="number" min="0" step="0.1" value="${assumptions.rate}"></label>
          <label>Monthly estimate<output id="estimateOutput">${money(monthly)}</output></label>
        </div>
      </form>` : `<div class="payment-estimator" id="paymentEstimator"><span class="eyebrow">PAYMENT ESTIMATOR</span><h2>Harga perlu disahkan dahulu.</h2><p>Hubungi advisor Izuwan untuk selling price terkini sebelum membuat anggaran pembiayaan.</p></div>`}
      <form class="viewing-card" id="viewingForm">
        <span class="eyebrow">VIEWING SLOT</span>
        <h2>Book a showroom viewing.</h2>
        <div class="form-grid">
          <label>Date<input id="viewingDate" type="date"></label>
          <label>Preferred time<select id="viewingTime"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></label>
        </div>
        <button type="submit">WhatsApp viewing request</button>
      </form>
    </section>
    <section class="car-confidence-strip">
      <article class="${car.auction_report ? "verified" : "confirm"}"><small>${car.auction_report ? "AVAILABLE" : "CONFIRM"}</small><strong>Auction report</strong><span>${safeText(auctionEvidence)}</span></article>
      <article class="${car.mileage_verified ? "verified" : "confirm"}"><small>${car.mileage_verified ? "VERIFIED" : "CONFIRM"}</small><strong>Mileage</strong><span>${safeText(mileageEvidence)}</span></article>
      <article class="${car.grade_verified ? "verified" : "confirm"}"><small>${car.grade_verified ? "VERIFIED" : "CONFIRM"}</small><strong>Grade & condition</strong><span>${safeText(gradeEvidence)}</span></article>
    </section>
    ${renderSimilar(car, allCars)}`;

    const mobileWhatsapp = document.querySelector("[data-mobile-whatsapp]");
    if (mobileWhatsapp) {
      mobileWhatsapp.dataset.whatsappMessage = whatsappMessage;
      mobileWhatsapp.href = window.IASBSite.whatsappUrl(whatsappMessage);
      mobileWhatsapp.querySelector("b").textContent = "Enquire car";
    }
    document.getElementById("paymentEstimator")?.addEventListener("submit", event => event.preventDefault());
    const malaysiaDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).reduce((parts, item) => {
      if (item.type !== "literal") parts[item.type] = item.value;
      return parts;
    }, {});
    document.getElementById("viewingDate").min = `${malaysiaDateParts.year}-${malaysiaDateParts.month}-${malaysiaDateParts.day}`;

    let activePhoto = 0;
    const dialog = document.getElementById("carImageDialog");
    const updateGallery = (index, updateMain = true) => {
      activePhoto = (index + photos.length) % photos.length;
      if (updateMain) {
        document.getElementById("carMainImage").src = photos[activePhoto];
        document.getElementById("carMainImage").alt = `${title}, gambar ${activePhoto + 1} daripada ${photos.length}`;
      }
      document.getElementById("carImageLarge").src = photos[activePhoto];
      document.getElementById("carImageLarge").alt = `${title}, gambar ${activePhoto + 1} daripada ${photos.length}`;
      document.getElementById("carImageDialogTitle").textContent = title;
      document.getElementById("carImageCounter").textContent = `${activePhoto + 1} / ${photos.length}`;
      document.querySelectorAll("[data-car-thumb-index]").forEach(item => item.classList.toggle("active", Number(item.dataset.carThumbIndex) === activePhoto));
      document.getElementById("carImagePrev").hidden = photos.length < 2;
      document.getElementById("carImageNext").hidden = photos.length < 2;
    };
    const openGallery = () => {
      updateGallery(activePhoto, false);
      dialog.showModal();
    };

    document.querySelectorAll("[data-car-thumb-index]").forEach(button => button.addEventListener("click", () => updateGallery(Number(button.dataset.carThumbIndex))));
    const openCarImage = document.getElementById("openCarImage");
    if (openCarImage) openCarImage.onclick = openGallery;
    document.getElementById("carImageClose").onclick = () => dialog.close();
    document.getElementById("carImagePrev").onclick = () => updateGallery(activePhoto - 1);
    document.getElementById("carImageNext").onclick = () => updateGallery(activePhoto + 1);
    dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
    dialog.onkeydown = event => {
      if (event.key === "ArrowLeft") updateGallery(activePhoto - 1);
      if (event.key === "ArrowRight") updateGallery(activePhoto + 1);
    };
    let touchStartX = 0;
    dialog.ontouchstart = event => { touchStartX = event.changedTouches[0].clientX; };
    dialog.ontouchend = event => {
      const distance = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(distance) > 45) updateGallery(activePhoto + (distance < 0 ? 1 : -1));
    };

    const estimateFields = ["estimateDownpayment", "estimateYears", "estimateRate"].map(id => document.getElementById(id)).filter(Boolean);
    if (estimateFields.length === 3) {
      const updateEstimate = () => {
        const downpayment = document.getElementById("estimateDownpayment").value;
        const years = document.getElementById("estimateYears").value;
        const rate = document.getElementById("estimateRate").value;
        document.getElementById("estimateOutput").textContent = money(paymentEstimate(car.price, downpayment, years, rate));
      };
      estimateFields.forEach(field => field.addEventListener("input", updateEstimate));
    }

    document.getElementById("viewingForm").addEventListener("submit", event => {
      event.preventDefault();
      const date = document.getElementById("viewingDate").value || "Flexible date";
      const time = document.getElementById("viewingTime").value;
      const message = `[Viewing Request] Hai Izuwan, saya nak book viewing untuk ${title} (${detailLine}). Preferred date/time: ${date}, ${time}.`;
      window.IASBLeadTracker?.track("viewing_request", { car_id: car.id, car_name: title, metadata: { date, time } });
      window.open(window.IASBSite.whatsappUrl(message), "_blank", "noopener");
    });
  }

  window.addEventListener("iasb:data", event => {
    const found = findCar(event.detail.inventory || []);
    render(found.car, found.allCars);
  });
  window.addEventListener("iasb:error", () => {
    const found = findCar(fallbackCars);
    render(found.car, found.allCars);
  });
  if (!window.IASBData?.configured) window.setTimeout(() => {
    const found = findCar(fallbackCars);
    render(found.car, found.allCars);
  }, 120);
})();
