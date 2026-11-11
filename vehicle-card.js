/* ============================================================
   IZUWAN — shared vehicle card renderer (vehicle-card.js)
   Single source for the VehicleCard component (spec §3.1).
   Used by: inventory grid, homepage featured grid, related rail.
   Depends on window.IASBSite (monthly estimate + whatsapp).
   ============================================================ */
(function () {
  "use strict";

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const hasValidPrice = value => Number.isFinite(Number(value)) && Number(value) >= 10000;

  function statusInfo(status) {
    const key = String(status || "").trim().replace(/\s+/g, " ").toUpperCase();
    const labels = window.IASBSite?.STATUS_LABELS || {};
    if (key === "SOLD") return { label: labels.SOLD || "Terjual", key: "sold" };
    if (key === "RESERVED" || key === "BOOKED") return { label: labels.BOOKED || "Ditempah", key: "booked" };
    if (key === "PORT KLANG") return { label: labels["PORT KLANG"] || "Di Pelabuhan", key: "port-klang" };
    if (key === "DONE PAID DUTI") return { label: labels["DONE PAID DUTI"] || "Sedia Diproses", key: "done-paid-duti" };
    if (key === "INCOMING") return { label: labels.INCOMING || "Akan Tiba", key: "incoming" };
    if (key === "AVAILABLE" || key === "READY STOCK") return { label: labels.AVAILABLE || "Ready Stock", key: "available" };
    return { label: labels[key] || String(status || "").trim() || "Semak status", key: "unknown" };
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function mediaUrls(car) {
    const gallery = Array.isArray(car.gallery_urls) ? car.gallery_urls : [];
    return [...new Set([car.image_url, ...gallery]
      .filter(value => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean))];
  }

  function mediaSrc(car) {
    return mediaUrls(car)[0] || "";
  }

  function factLine(car) {
    const parts = [];
    if (car.year) parts.push(String(car.year).trim());
    if (car.mileage !== null && car.mileage !== undefined && String(car.mileage).trim() !== "" && Number.isFinite(Number(car.mileage)) && Number(car.mileage) >= 0) {
      parts.push(`${Math.round(Number(car.mileage)).toLocaleString("en-MY")} km`);
    }
    if (String(car.grade || "").trim()) parts.push(`Grade ${String(car.grade).trim()}`);
    return parts.join(" · ");
  }

  function priceBlock(car) {
    if (!hasValidPrice(car.price)) {
      return `<strong class="price-poa">Harga belum disahkan.</strong>
          <small>Hubungi advisor untuk harga terkini.</small>`;
    }
    const monthly = window.IASBSite?.monthlyEstimate
      ? window.IASBSite.monthlyEstimate(car.price)
      : Math.round(((Number(car.price) * 0.9) * (1 + 0.032 * 9)) / 108);
    const assumptions = window.IASBSite?.financeAssumptions?.() || { depositPct: 10, years: 9, rate: 3.2 };
    return `<strong>${money(car.price)}</strong>
      <small>${money(monthly)}/bulan anggaran <span class="tenure">(${safeText(assumptions.depositPct)}% · ${safeText(assumptions.years)} thn · ${safeText(assumptions.rate)}%)</span></small>`;
  }

  function enquiryMessage(car) {
    const name = [car.brand, car.model].filter(Boolean).join(" ");
    const detail = [car.year, car.grade, car.variant].filter(Boolean).join(" / ");
    const reference = String(car.marketing_label || car.chassis_no || "").replace(/^sheet:/, "");
    const context = detail ? ` (${detail})` : "";
    const ref = reference ? ` [Ref: ${reference}]` : "";
    return `[Inventory Page] Hai, saya berminat dengan ${name}${context}.${ref} Unit masih available?${car.id ? ` https://izuwanautomobile.com/car?id=${encodeURIComponent(car.id)}` : ""}`;
  }

  /**
   * Render one vehicle card.
   * @param {object} car merged inventory row
   * @param {object} options { hrefBase: "car.html"|"car", photoAdvance: bool, mediaHref: bool }
   */
  function renderCard(car, options = {}) {
    const opts = { hrefBase: "car", photoAdvance: true, showActions: true, ...options };
    const name = [car.brand, car.model].filter(Boolean).join(" ") || "Izuwan unit";
    const photo = mediaSrc(car);
    const gallery = mediaUrls(car);
    const state = statusInfo(car.status);
    const isSold = state.key === "sold";
    const priceValid = hasValidPrice(car.price);
    const detailHref = car.id
      ? `${opts.hrefBase === "car" ? "car.html" : opts.hrefBase}?id=${encodeURIComponent(car.id)}`
      : opts.hrefBase === "car"
        ? "inventory.html"
        : String(opts.hrefBase).replace("car", "inventory");
    const titleLine = factLine(car);
    const variant = String(car.variant || "").trim();
    const showVariant = variant && ![name, String(car.model || "").trim()].some(value => value.toLowerCase() === variant.toLowerCase());
    const campaign = car.campaign_tag ? `<span>${safeText(car.campaign_tag)}</span>` : "";
    const photoCount = gallery.length > 1 ? `<span>${gallery.length} gambar</span>` : "";
    const photoContent = photo
        ? `<img src="${safeText(photo)}" alt="${safeText(name)}${car.year ? " " + safeText(car.year) : ""}, gambar unit" loading="lazy" decoding="async" width="720" height="480">`
      : `<div class="vehicle-placeholder" role="img" aria-label="Gambar unit belum tersedia">
          <svg class="vehicle-placeholder-icon" viewBox="0 0 64 40" width="64" height="40" fill="none" aria-hidden="true"><path d="M10 25l5-13a4 4 0 0 1 4-3h26a4 4 0 0 1 4 3l5 13M8 25h48v9H8zM20 34v3M44 34v3M17 29h5M42 29h5M18 14h28l3 10H15z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="vehicle-placeholder-copy">Gambar unit belum tersedia</span>
        </div>`;
    const mediaTag = opts.photoAdvance && photo
      ? `<a class="vehicle-media" href="${detailHref}" aria-label="Lihat ${safeText(name)}${photo ? "" : ". Gambar unit belum tersedia"}">${photoContent}${photoCount}</a>`
      : `<a class="vehicle-media" href="${detailHref}" aria-label="Lihat ${safeText(name)}${photo ? "" : ". Gambar unit belum tersedia"}">${photoContent}</a>`;
    const actions = opts.showActions
      ? `<div class="vehicle-actions">
          <a class="vc-details" href="${detailHref}" data-lead-action="inventory_details" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}">Lihat kereta</a>
          <a class="vc-wa" data-stock-enquiry data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}" data-message="${safeText(enquiryMessage(car))}" href="${safeText(window.IASBSite.whatsappUrl(enquiryMessage(car)))}" target="_blank" rel="noopener" aria-label="WhatsApp tentang ${safeText(name)}">WhatsApp</a>
        </div>`
      : "";
    return `<article class="inventory-card vehicle-card${isSold ? " is-sold" : ""}" data-type="${safeText(car.type || "Other")}">
      ${mediaTag}
      <div class="inventory-card-body">
        <div class="inventory-meta">
          <span>${safeText(car.brand || "Recond")} / ${safeText(car.type || "Japan Recond")}</span>
          <b class="stock-status status-${state.key}"><i aria-hidden="true"></i>${safeText(state.label)}</b>
        </div>
        ${campaign ? `<div class="stock-badges">${campaign}</div>` : ""}
        <h2 class="vehicle-title"><a class="inventory-title-link" href="${detailHref}" data-lead-action="inventory_details" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}">${safeText(name)}</a></h2>
        ${showVariant ? `<p class="vehicle-variant">${safeText(variant)}</p>` : ""}
        ${titleLine ? `<p class="vehicle-facts">${safeText(titleLine)}</p>` : ""}
        <div class="inventory-price">
          <div>${priceBlock(car)}</div>
          ${priceValid ? `<a class="inventory-calc-link" href="calculator.html?price=${Number(car.price) || 0}&car=${encodeURIComponent(name + (car.variant ? ` - ${car.variant}` : ""))}" data-lead-action="inventory_calculator" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}">Ubah anggaran →</a>` : ""}
        </div>
        ${actions}
      </div>
    </article>`;
  }

  window.IASBCards = { renderCard, statusInfo, money, hasValidPrice, safeText, enquiryMessage, mediaSrc, mediaUrls };
})();
