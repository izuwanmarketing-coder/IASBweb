/* ============================================================
   IZUWAN — shared vehicle card renderer (vehicle-card.js)
   Single source for the VehicleCard component (spec §3.1).
   Used by: inventory grid, homepage featured grid, related rail.
   Depends on window.IASBSite (monthly estimate + whatsapp).
   ============================================================ */
(function () {
  "use strict";

  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  const hasValidPrice = value => Number(value) >= 10000;

  function statusInfo(status) {
    const key = String(status || "AVAILABLE").toUpperCase();
    const labels = window.IASBSite?.STATUS_LABELS || {};
    if (key === "SOLD") return { label: labels.SOLD || "Terjual", key: "sold" };
    if (key === "RESERVED" || key === "BOOKED") return { label: labels.BOOKED || "Ditempah", key: "booked" };
    if (key === "PORT KLANG") return { label: labels["PORT KLANG"] || "Di Pelabuhan", key: "port-klang" };
    if (key === "DONE PAID DUTI") return { label: labels["DONE PAID DUTI"] || "Sedia Diproses", key: "done-paid-duti" };
    if (key === "INCOMING") return { label: labels.INCOMING || "Akan Tiba", key: "incoming" };
    return { label: labels.AVAILABLE || "Ready Stock", key: "available" };
  }

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function mediaSrc(car) {
    return (car.image_url || (car.gallery_urls || [])[0] || "").trim();
  }

  function factLine(car) {
    const parts = [];
    if (Number(car.mileage) > 0) parts.push(`${Math.round(Number(car.mileage)).toLocaleString("en-MY")} km`);
    if (car.grade) parts.push(`Grade ${String(car.grade).trim()}`);
    if (!parts.length && car.year) parts.push(String(car.year));
    return parts.join(" · ");
  }

  function priceBlock(car, options) {
    const opts = options || {};
    if (!hasValidPrice(car.price)) {
      return `<strong class="price-poa">Harga di pengesahan</strong>
          <small>Incoming / port unit. WhatsApp untuk anggaran landing</small>`;
    }
    const monthly = window.IASBSite?.monthlyEstimate
      ? window.IASBSite.monthlyEstimate(car.price)
      : Math.round(((Number(car.price) * 0.9) * (1 + 0.032 * 9)) / 108);
    return `<strong>${money(car.price)}</strong>
      <small>${money(monthly)}/bulan anggaran <span class="tenure">(10% · 9 thn · 3.2%)</span></small>`;
  }

  function enquiryMessage(car) {
    const name = [car.brand, car.model].filter(Boolean).join(" ");
    const detail = [car.year, car.grade, car.variant].filter(Boolean).join(" / ");
    const reference = String(car.marketing_label || car.chassis_no || "").replace(/^sheet:/, "");
    const context = detail ? ` (${detail})` : "";
    const ref = reference ? ` [Ref: ${reference}]` : "";
    return `[Inventory Page] Hai, saya berminat dengan ${name}${context}.${ref} Unit masih available?`;
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
    const gallery = [car.image_url, ...(car.gallery_urls || [])].filter(Boolean);
    const state = statusInfo(car.status);
    const isSold = state.key === "sold";
    const isReserved = state.key === "booked";
    const priceValid = hasValidPrice(car.price);
    const detailHref = car.id
      ? `${opts.hrefBase === "car" ? "car.html" : opts.hrefBase}?id=${encodeURIComponent(car.id)}`
      : opts.hrefBase === "car"
        ? "inventory.html"
        : String(opts.hrefBase).replace("car", "inventory");
    const titleLine = factLine(car) || [car.year, car.variant].filter(Boolean).join(" · ") || "Japan recondition";
    const campaign = car.campaign_tag ? `<span>${safeText(car.campaign_tag)}</span>` : "";
    const grade = car.grade && car.mileage ? "" : (car.grade ? `<span>Grade ${safeText(car.grade)}</span>` : "");
    const photoCount = gallery.length > 1 ? `<span>${gallery.length} gambar</span>` : "";
    const photoContent = photo
        ? `<img src="${safeText(photo)}" alt="${safeText(name)}${car.year ? " " + safeText(car.year) : ""}, gambar unit" loading="lazy" decoding="async">`
      : `<div class="vehicle-placeholder">${safeText((car.brand || "IZUWAN").slice(0, 12).toUpperCase())}</div>`;
    const mediaTag = opts.photoAdvance && photo
      ? `<a class="vehicle-media" href="${detailHref}" aria-label="Lihat ${safeText(name)}">${photoContent}${photoCount}</a>`
      : `<a class="vehicle-media" href="${detailHref}" aria-label="Lihat ${safeText(name)}">${photoContent}</a>`;
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
        ${campaign || grade ? `<div class="stock-badges">${campaign}${grade}</div>` : ""}
        <h2 class="vehicle-title"><a class="inventory-title-link" href="${detailHref}" data-lead-action="inventory_details" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}">${safeText(name)}</a></h2>
        <p>${safeText(titleLine)}</p>
        <div class="inventory-price">
          <div>${priceBlock(car, opts)}</div>
          ${priceValid ? `<a class="inventory-calc-link" href="calculator.html?price=${Number(car.price) || 0}&car=${encodeURIComponent(name + (car.variant ? ` - ${car.variant}` : ""))}" data-lead-action="inventory_calculator" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(name)}">Kira tepat →</a>` : ""}
        </div>
        ${actions}
      </div>
    </article>`;
  }

  window.IASBCards = { renderCard, statusInfo, money, hasValidPrice, safeText, enquiryMessage, mediaSrc };
})();
