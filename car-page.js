/* ============================================================
   IZUWAN — vehicle detail page v2 (car-page.js)
   Spec §3.2–§3.3: the PDP contract. Sticky right rail on desktop,
   mobile gallery-first, 3-layer price block, grade explainer,
   evidence strip, per-vehicle OG + Product JSON-LD, related rail.
   Spec rows render from data or are omitted — never "Upon request".
   ============================================================ */
(function () {
  "use strict";
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
  const { renderCard, money, safeText, statusInfo } = window.IASBCards;

  const hasValidPrice = window.IASBCards.hasValidPrice;
  const mileageText = value => Number(value) > 0
    ? `${Math.round(Number(value)).toLocaleString("en-MY")} km`
    : "";

  function formatUpdated(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ms-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  function photosFor(car) {
    const urls = [];
    if (car.image_url) urls.push(car.image_url);
    (car.gallery_urls || []).forEach(url => url && urls.push(url));
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

  /* Spec rows render only from data (spec §1.3, §3.3) */
  function specRow(label, value, derived) {
    if (value === undefined || value === null || String(value).trim() === "") return "";
    return `<div><span>${safeText(label)}${derived ? ' <i class="spec-derived" title="Dirumuskan daripada kod casis">≈</i>' : ""}</span><strong>${safeText(value)}</strong></div>`;
  }

  function gradeChip(grade) {
    if (!grade) return "";
    return `<button type="button" class="grade-chip" id="gradeChip" aria-haspopup="dialog" title="Apakah maksud grade ini?">Gred ${safeText(grade)} <span aria-hidden="true">?</span></button>`;
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
    if (!photos.length) {
      return `<div class="car-detail-placeholder"><span>IA</span><p>Gambar unit ini akan dikemaskini — minta gambar terkini melalui WhatsApp.</p></div>`;
    }
    return `<button class="car-main-image-button" id="openCarImage" type="button" aria-label="Buka galeri ${safeText(title)} dalam skrin penuh">
        <img class="car-main-image" id="carMainImage" src="${safeText(photos[0])}" alt="${safeText(title)}, gambar 1 daripada ${photos.length}">
        <span class="car-image-expand">Lihat gambar penuh <b>↗</b></span>
      </button>
      ${photos.length > 1 ? `<div class="car-thumbs" aria-label="Pilihan gambar">${photos.slice(0, 12).map((src, index) => `<button type="button" data-car-thumb-index="${index}" class="${index === 0 ? "active" : ""}" aria-label="Lihat gambar ${index + 1} daripada ${photos.length}"><img src="${safeText(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}`;
  }

  function storyBlock(car) {
    /* Structured "Kenapa unit ini" — auto-composed from real fields only (spec §3.2). */
    const lines = [];
    const name = `${car.brand || ""} ${car.model || ""}`.trim();
    if (car.grade) lines.push(`Unit ini tiba dengan auction grade ${safeText(car.grade)} — keadaan asal Jepun direkodkan dalam laporan lelongan.`);
    if (Number(car.mileage) > 0 && car.year) {
      const age = Math.max(1, new Date().getFullYear() - Number(car.year));
      const perYear = Math.round(Number(car.mileage) / age);
      lines.push(`Odometer ${mileageText(car.mileage)}${car.year ? ` untuk pengeluaran ${safeText(car.year)} (±${perYear.toLocaleString("en-MY")} km setahun)` : ""}.`);
    } else if (Number(car.mileage) > 0) {
      lines.push(`Odometer ${mileageText(car.mileage)}.`);
    }
    if (car.description) lines.push(safeText(car.description));
    if (car.location) lines.push(`Unit ini berada di ${safeText(car.location)} — boleh dilihat hari ini dalam waktu operasi showroom.`);
    if (!lines.length) return "";
    return `<div class="car-story"><span class="eyebrow">KENAPA UNIT INI</span><p>${lines.join(" ")}</p></div>`;
  }

  function evidenceStrip(car, title) {
    const auction = car.auction_report
      ? { cls: "verified", tag: "AVAILABLE", text: "Laporan lelongan tersedia untuk semakan bersama advisor." }
      : { cls: "confirm", tag: "PENGESAHAN", text: "Status report belum dinyatakan — minta advisor semak untuk anda." };
    const mileage = car.mileage_verified
      ? { cls: "verified", tag: "VERIFIED", text: `${mileageText(car.mileage)} ditandakan telah disahkan.` }
      : { cls: "confirm", tag: "PENGESAHAN", text: mileageText(car.mileage) ? "Mileage dipaparkan; minta pengesahan advisor." : "Mileage akan disahkan bersama advisor." };
    const grade = car.grade_verified
      ? { cls: "verified", tag: "VERIFIED", text: `Gred ${safeText(car.grade || "unit")} direkodkan daripada laporan asal.` }
      : { cls: "confirm", tag: "PENGESAHAN", text: "Keadaan akhir dan grade disahkan bersama advisor sebelum deposit." };
    return `<section class="car-confidence-strip" aria-label="Bukti keadaan unit">
      <article class="${auction.cls}"><small>${auction.tag}</small><strong>Auction report</strong><span>${safeText(auction.text)}</span></article>
      <article class="${mileage.cls}"><small>${mileage.tag}</small><strong>Mileage</strong><span>${safeText(mileage.text)}</span></article>
      <article class="${grade.cls}"><small>${grade.tag}</small><strong>Grade & condition</strong><span>${safeText(grade.text)}</span></article>
    </section>
    <div class="evidence-cta">
      <a href="${window.IASBSite.whatsappUrl(`[Car Detail Page] Hai, boleh share auction sheet / report untuk ${title}?`)}" target="_blank" rel="noopener" data-lead-action="car_sheet_request" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(title)}">Minta auction sheet melalui WhatsApp ↗</a>
    </div>`;
  }

  function relatedRail(car, allCars) {
    const sameModel = (allCars || []).filter(item => item && item !== car && item.model === car.model && item.id !== car.id);
    const sameType = (allCars || []).filter(item => item && item !== car && item.model !== car.model && item.type === car.type && item.id !== car.id);
    const priceBand = (allCars || []).filter(item => item && item !== car && item.type !== car.type && item.model !== car.model && Math.abs(Number(item.price || 0) - Number(car.price || 0)) <= Number(car.price || 0) * 0.18);
    const similar = [...sameModel, ...sameType, ...priceBand].slice(0, 3);
    if (!similar.length) return "";
    return `<section class="similar-stock">
      <div class="section-heading"><div><span class="eyebrow">SIMILAR READY STOCK</span><h2>You may also like.</h2></div><a class="section-link" href="inventory.html">View all →</a></div>
      <div class="similar-grid">${similar.map(item => {
        const href = item.id ? `car.html?id=${encodeURIComponent(item.id)}` : `inventory.html`;
        const state = statusInfo(item.status);
        const price = hasValidPrice(item.price) ? money(item.price) : "Harga di pengesahan";
        return `<a href="${href}" class="similar-card">
          <b class="stock-status status-${state.key}"><i aria-hidden="true"></i>${safeText(state.label)}</b>
          <h3>${safeText(item.brand)} ${safeText(item.model)}</h3>
          <p>${safeText([item.year, item.grade, item.variant].filter(Boolean).join(" · ") || item.type || "Recond")}</p>
          <strong>${safeText(price)}</strong>
        </a>`;
      }).join("")}</div>
    </section>`;
  }

  function render(car, allCars) {
    if (!car) return notFound();
    const detailLine = [car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "Japan reconditioned unit";
    const title = `${car.brand || ""} ${car.model || ""}`.trim() || "Izuwan ready stock";
    const photos = photosFor(car);
    const validPrice = hasValidPrice(car.price);
    const monthly = validPrice ? paymentEstimate(car.price) : 0;
    const assumptions = window.IASBSite?.financeAssumptions() || { depositPct: 10, years: 9, rate: 3.2 };
    const defaultDownpayment = Math.round((Number(car.price) || 0) * assumptions.depositPct / 100);
    const updated = formatUpdated(car.updated_at || car.created_at);
    const state = statusInfo(car.status);
    const whatsappMessage = `[Car Detail Page] Hai, saya berminat dengan ${title}${detailLine ? ` (${detailLine})` : ""}. Boleh share details dan availability terkini?`;
    document.title = `${title} | Izuwan Automobile`;
    const breadcrumb = document.getElementById("breadcrumbCar");
    if (breadcrumb) breadcrumb.textContent = title;

    /* Per-vehicle OG + Product JSON-LD (spec §3.3 #10) */
    const headImage = photos[0];
    if (headImage) {
      let og = document.querySelector('meta[property="og:image"]');
      if (!og) { og = document.createElement("meta"); og.setAttribute("property", "og:image"); document.head.appendChild(og); }
      og.setAttribute("content", headImage);
    }
    const ldScript = document.createElement("script");
    ldScript.type = "application/ld+json";
    ldScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Car",
      name: title,
      brand: { "@type": "Brand", name: car.brand || "" },
      model: car.model || "",
      vehicleModelDate: car.year ? String(car.year) : undefined,
      mileage: Number(car.mileage) > 0 ? { "@type": "QuantitativeValue", value: Number(car.mileage), unitCode: "KMT" } : undefined,
      color: car.exterior_color || undefined,
      vehicleTransmission: car.transmission || undefined,
      fuelType: car.engine || undefined,
      image: photos.slice(0, 6),
      offers: validPrice
        ? { "@type": "Offer", price: Number(car.price), priceCurrency: "MYR", availability: state.key === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock", itemCondition: "https://schema.org/UsedCondition" }
        : undefined
    });
    document.head.appendChild(ldScript);

    const specs = [
      specRow("Year", car.year),
      specRow("Grade", car.grade),
      specRow("Mileage", mileageText(car.mileage)),
      specRow("Variant", car.variant),
      specRow("Engine", car.engine, true),
      specRow("Transmission", car.transmission, true),
      specRow("Exterior", car.exterior_color),
      specRow("Location", car.location),
      specRow("Stock ref", (car.marketing_label || "").replace(/^sheet:/, "") || car.chassis_no),
      specRow("Chassis no", car.chassis_no)
    ].join("");

    root.innerHTML = `<section class="car-detail-shell car-detail-v2">
      <div class="car-detail-media">${renderGallery(photos, title)}</div>
      <article class="car-detail-panel">
        <small class="car-status-line">
          <b class="stock-status status-${state.key}"><i aria-hidden="true"></i>${safeText(state.label)}</b>
          <span>${safeText(car.location || "Izuwan Automobile")}${updated ? ` · Dikemas kini ${safeText(updated)}` : ""}</span>
          ${gradeChip(car.grade)}
        </small>
        <h1>${safeText(title)}</h1>
        ${car.variant ? `<p class="car-variant-line">${safeText(car.variant)}</p>` : ""}
        ${storyBlock(car)}
        <div class="car-detail-price">
          <span>${validPrice ? "Anggaran selling price" : "Harga unit"}</span>
          <strong>${validPrice ? money(car.price) : "Harga di pengesahan"}</strong>
          ${validPrice
            ? `<em>± ${money(monthly)}/bulan <b class="tenure">(${assumptions.depositPct}% deposit · ${assumptions.years} tahun · ${assumptions.rate}% p.a. anggaran)</b></em>
               <small class="car-price-note">Anggaran kadar rata. Tertakluk kepada kelulusan bank, CCRIS/CTOS dan dokumen. Insurance dan OTR disahkan bersama advisor.</small>`
            : `<em>Unit incoming / di pelabuhan — WhatsApp advisor untuk anggaran landing price terkini.</em>`}
          ${validPrice ? `<a class="car-price-calc" href="calculator.html?price=${Number(car.price) || 0}&car=${encodeURIComponent(title)}" data-lead-action="car_calculator" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(title)}">Kira tepat dalam kalkulator →</a>` : ""}
        </div>
        <div class="car-spec-grid">${specs}</div>
        <div class="car-detail-actions">
          <a href="${window.IASBSite.whatsappUrl(whatsappMessage)}" data-lead-action="car_whatsapp" data-car-id="${safeText(car.id || "")}" data-car-name="${safeText(title)}" target="_blank" rel="noopener">WhatsApp enquiry <span aria-hidden="true">↗</span></a>
          <a class="outline" href="#paymentEstimator">Estimate monthly</a>
          <a class="ghost" href="inventory.html">Back to inventory</a>
        </div>
      </article>
    </section>
    <section class="car-detail-tools">
      ${validPrice ? `<form class="payment-estimator" id="paymentEstimator">
        <span class="eyebrow">PAYMENT ESTIMATOR</span>
        <h2>Quick monthly estimate.</h2>
        <p class="estimator-note">Edit deposit dan tenure. Kadar kekal anggaran default — kadar sebenar bergantung kepada bank.</p>
        <div class="form-grid">
          <label>Downpayment (RM)<input id="estimateDownpayment" type="number" min="0" value="${defaultDownpayment}"></label>
          <label>Tenure<select id="estimateYears"><option value="5">5 years</option><option value="7">7 years</option><option value="9" selected>9 years</option></select></label>
          <label class="estimator-output-label">Monthly estimate<output id="estimateOutput">${money(monthly)}</output></label>
        </div>
        <small class="estimator-disclaimer">Anggaran kadar rata (10%/9 thn/3.2% default). Penyelesaian awal mengikut baki berkurangan (HPAA 2026). Tertakluk kepada kelulusan bank.</small>
      </form>` : `<div class="payment-estimator" id="paymentEstimator"><span class="eyebrow">PAYMENT ESTIMATOR</span><h2>Harga perlu disahkan dahulu.</h2><p>Hubungi advisor Izuwan untuk selling price terkini sebelum membuat anggaran pembiayaan.</p></div>`}
      <form class="viewing-card" id="viewingForm">
        <span class="eyebrow">VIEWING SLOT</span>
        <h2>Book a showroom viewing.</h2>
        <p class="estimator-note">Pilih tarikh — advisor sahkan slot dalam 1 jam waktu operasi. Unit ini di ${safeText(car.location || "showroom kami")}.</p>
        <div class="form-grid">
          <label>Date<input id="viewingDate" type="date"></label>
          <label>Preferred time<select id="viewingTime"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></label>
        </div>
        <button type="submit">WhatsApp viewing request <span aria-hidden="true">↗</span></button>
      </form>
    </section>
    ${evidenceStrip(car, title)}
    ${relatedRail(car, allCars)}`;

    /* Mobile sticky bar (spec §3.3): two actions, appears after price block */
    const mobileWhatsapp = document.querySelector("[data-mobile-whatsapp]");
    if (mobileWhatsapp) {
      mobileWhatsapp.dataset.whatsappMessage = whatsappMessage;
      mobileWhatsapp.href = window.IASBSite.whatsappUrl(whatsappMessage);
      mobileWhatsapp.setAttribute("aria-label", `Enquire about ${title} on WhatsApp`);
      const label = mobileWhatsapp.querySelector("b");
      if (label) label.textContent = "Enquire";
    }

    /* Grade explainer dialog (spec §3.5 / §3.11) */
    const gradeChipEl = document.getElementById("gradeChip");
    if (gradeChipEl) {
      gradeChipEl.addEventListener("click", () => {
        let dialog = document.getElementById("gradeDialog");
        if (!dialog) {
          dialog = document.createElement("dialog");
          dialog.id = "gradeDialog";
          dialog.className = "grade-dialog";
          dialog.innerHTML = `
            <button class="dialog-close" id="gradeDialogClose" type="button" aria-label="Tutup">×</button>
            <span class="eyebrow">PANDUAN GRADE</span>
            <h2>Apakah maksud gred auction?</h2>
            <p>Setiap unit recond Izuwan dihargai berdasarkan laporan lelongan Jepun. Gred keseluruhan mencerminkan keadaan asal kenderaan:</p>
            <dl class="grade-scale">
              <div><b>5 / 5A</b><dd>Keadaan hampir baru — mileage sangat rendah, tiada tanda pembaikan ketara.</dd></div>
              <div><b>4.5 / 4.5B</b><dd>Keadaan sangat baik. Huruf B bermaksud terdapat tanda kecil yang telah direkodkan (bukan kemalangan berat).</dd></div>
              <div><b>4 / 4B</b><dd>Keadaan baik dengan penggunaan biasa — tanda kecil kosmetik direkodkan dalam sheet.</dd></div>
              <div><b>3.5 / 3</b><dd>Keadaan sederhana — lebih banyak tanda penggunaan atau pembaikan kecil.</dd></div>
              <div><b>R / RA</b><dd>Unit dengan sejarah pembaikan kemalangan. Izuwan hanya membawa grade tinggi dan menerangkan setiap notation kepada anda.</dd></div>
            </dl>
            <p class="fine-print">Minta auction sheet sebenar untuk unit ini melalui WhatsApp — kami kongsi laporan asal sebelum anda membuat keputusan.</p>
            <div class="grade-dialog-actions">
              <a class="button-whatsapp" href="${window.IASBSite.whatsappUrl(`[Car Detail Page] Hai, boleh terangkan auction sheet untuk ${title}?`)}" target="_blank" rel="noopener">Minta sheet via WhatsApp</a>
            </div>`;
          document.body.appendChild(dialog);
          dialog.querySelector("#gradeDialogClose").addEventListener("click", () => dialog.close());
          dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        }
        dialog.showModal();
      });
    }

    /* Estimator + viewing + gallery interactions (contracts preserved) */
    document.getElementById("paymentEstimator")?.addEventListener("submit", event => event.preventDefault());
    const malaysiaDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date()).reduce((parts, item) => {
      if (item.type !== "literal") parts[item.type] = item.value;
      return parts;
    }, {});
    const viewingDate = document.getElementById("viewingDate");
    if (viewingDate) viewingDate.min = `${malaysiaDateParts.year}-${malaysiaDateParts.month}-${malaysiaDateParts.day}`;

    const estimateFields = ["estimateDownpayment", "estimateYears"].map(id => document.getElementById(id)).filter(Boolean);
    if (estimateFields.length === 2) {
      const updateEstimate = () => {
        const downEl = document.getElementById("estimateDownpayment");
        const yearsEl = document.getElementById("estimateYears");
        const bad = downEl.validity.badInput || downEl.validity.rangeUnderflow || !Number.isFinite(Number(downEl.value)) || Number(downEl.value) < 0;
        downEl.setAttribute("aria-invalid", String(bad));
        if (bad) {
          document.getElementById("estimateOutput").textContent = "Semak input";
          return;
        }
        document.getElementById("estimateOutput").textContent = money(paymentEstimate(car.price, downEl.value, yearsEl.value));
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

    let activePhoto = 0;
    const dialog = document.getElementById("carImageDialog");
    const reduceGalleryMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let galleryCloseTimer = 0;
    const animateGalleryImage = image => {
      if (reduceGalleryMotion || !dialog.open || !image) return;
      image.classList.remove("is-changing");
      void image.offsetWidth;
      image.classList.add("is-changing");
    };
    const updateGallery = (index, updateMain = true) => {
      if (!photos.length) return;
      activePhoto = (index + photos.length) % photos.length;
      if (updateMain) {
        const mainImage = document.getElementById("carMainImage");
        if (mainImage) {
          mainImage.src = photos[activePhoto];
          mainImage.alt = `${title}, gambar ${activePhoto + 1} daripada ${photos.length}`;
          animateGalleryImage(mainImage);
        }
      }
      const largeImage = document.getElementById("carImageLarge");
      if (largeImage) {
        largeImage.src = photos[activePhoto];
        largeImage.alt = `${title}, gambar ${activePhoto + 1} daripada ${photos.length}`;
        animateGalleryImage(largeImage);
      }
      const dialogTitle = document.getElementById("carImageDialogTitle");
      if (dialogTitle) dialogTitle.textContent = title;
      const counter = document.getElementById("carImageCounter");
      if (counter) counter.textContent = `${activePhoto + 1} / ${photos.length}`;
      document.querySelectorAll("[data-car-thumb-index]").forEach(item => item.classList.toggle("active", Number(item.dataset.carThumbIndex) === activePhoto));
      const prev = document.getElementById("carImagePrev");
      const next = document.getElementById("carImageNext");
      if (prev) prev.hidden = photos.length < 2;
      if (next) next.hidden = photos.length < 2;
    };
    const openGallery = () => {
      if (!photos.length) return;
      updateGallery(activePhoto, false);
      dialog.showModal();
      window.clearTimeout(galleryCloseTimer);
      dialog.classList.remove("is-closing");
      dialog.classList.add("is-visible");
    };
    const closeGallery = () => {
      if (!dialog.open) return;
      window.clearTimeout(galleryCloseTimer);
      if (reduceGalleryMotion) {
        dialog.close();
        dialog.classList.remove("is-visible");
        return;
      }
      dialog.classList.remove("is-visible");
      dialog.classList.add("is-closing");
      galleryCloseTimer = window.setTimeout(() => {
        dialog.close();
        dialog.classList.remove("is-closing");
      }, 180);
    };

    document.querySelectorAll("[data-car-thumb-index]").forEach(button => button.addEventListener("click", () => updateGallery(Number(button.dataset.carThumbIndex))));
    const openCarImage = document.getElementById("openCarImage");
    if (openCarImage) openCarImage.onclick = openGallery;
    const closeBtn = document.getElementById("carImageClose");
    if (closeBtn) closeBtn.onclick = closeGallery;
    const prevBtn = document.getElementById("carImagePrev");
    if (prevBtn) prevBtn.onclick = () => updateGallery(activePhoto - 1);
    const nextBtn = document.getElementById("carImageNext");
    if (nextBtn) nextBtn.onclick = () => updateGallery(activePhoto + 1);
    dialog.onclick = event => { if (event.target === dialog) closeGallery(); };
    dialog.oncancel = event => { event.preventDefault(); closeGallery(); };
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
