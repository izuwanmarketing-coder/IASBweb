/* ============================================================
   IZUWAN — homepage logic v2 (overhaul.js)
   Spec §4.1: compressed hero with live-count chip, curated
   featured collection via shared VehicleCard, unified finance
   (IASBSite.monthlyEstimate), trust strip, discovery section,
   deliveries, showroom strip. No Tailwind, no fallback pricing.
   ============================================================ */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const media = value => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  let whatsappNumber = window.IASB_CONFIG?.fallbackWhatsapp || "60192788667";
  const whatsapp = message => `https://wa.me/${String(whatsappNumber).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  const { renderCard, money, hasValidPrice } = window.IASBCards;

  /* Live hero chip: real count + PRICELIST date from data (spec §4.1.1) */
  function updateHeroChip(inventory, settings) {
    const chip = document.getElementById("heroLiveChip");
    if (!chip) return;
    const live = (inventory || []).filter(car => car && car.is_active !== false);
    const units = live.reduce((sum, car) => sum + (Number(car.units) || 1), 0);
    const pricelist = settings?.pricelist_date || live.find(car => car.campaign_tag)?.campaign_tag?.replace("PRICELIST ", "") || "";
    chip.innerHTML = `<i aria-hidden="true"></i><b>${units ? units.toLocaleString("en-MY") : "—"} unit</b> ready stock${pricelist ? ` · PRICELIST ${safe(pricelist)}` : ""}`;
  }

  /* Featured collection: managed featured first, then photographic
     coverage + price-ladder spread. 6 slots (spec §4.1.2). */
  function pickFeatured(cars) {
    const live = (cars || []).filter(car => car && car.is_active !== false);
    const featured = live.filter(car => car.is_featured);
    const withPhotos = live.filter(car => !car.is_featured && (car.image_url || (car.gallery_urls || []).length));
    const withoutPhotos = live.filter(car => !(car.image_url || (car.gallery_urls || []).length));
    const ladder = cars => {
      const sorted = [...cars].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      const picks = [];
      if (sorted.length) picks.push(sorted[0]);
      if (sorted.length > 2) picks.push(sorted[Math.floor(sorted.length / 2)]);
      if (sorted.length > 1) picks.push(sorted[sorted.length - 1]);
      return picks;
    };
    const picked = new Map();
    const add = car => { if (car && !picked.has(car.id || car.chassis_no)) picked.set(car.id || car.chassis_no, car); };
    featured.slice(0, 3).forEach(add);
    ladder(withPhotos).forEach(add);
    withPhotos.forEach(add);
    ladder(withoutPhotos).forEach(add);
    withoutPhotos.forEach(add);
    return [...picked.values()].slice(0, 6);
  }

  let inventory = [];
  let shownCars = [];
  const cardToCar = new Map();
  let usingFallback = true;

  function renderInventory() {
    const grid = $("inventoryGrid");
    if (!grid) return;
    const term = ($("stockSearch")?.value || "").trim().toLowerCase();
    shownCars = pickFeatured(inventory).filter(car => {
      if (!term) return true;
      return [car.brand, car.model, car.variant, car.year].join(" ").toLowerCase().includes(term);
    });
    cardToCar.clear();
    grid.setAttribute("aria-busy", "false");
    if (!shownCars.length) {
      grid.innerHTML = `<div class="empty-stock"><h3>Belum jumpa model itu.</h3><p>WhatsApp advisor dan kami akan semak ready stock atau carikan dari Jepun.</p><a class="button button-primary" href="${safe(whatsapp("Salam Izuwan Automobile, boleh bantu cari kereta mengikut spesifikasi dan bajet saya?"))}" target="_blank" rel="noopener">Bantu saya cari ↗</a></div>`;
      $("stockStatus").textContent = "Tiada padanan";
      return;
    }
    grid.innerHTML = shownCars.map(car => {
      const html = renderCard(car, { hrefBase: "car.html" });
      const wrapper = document.createElement("template");
      wrapper.innerHTML = html.trim();
      const card = wrapper.content.firstElementChild;
      cardToCar.set(card, car);
      return html;
    }).join("");
    /* Re-bind map after innerHTML replace */
    [...grid.querySelectorAll(".vehicle-card")].forEach(card => {
      const id = card.querySelector("a[data-car-id]")?.dataset.carId;
      const car = shownCars.find(item => String(item.id) === String(id));
      if (car) cardToCar.set(card, car);
    });
    $("stockStatus").textContent = `${shownCars.length} unit dipaparkan${usingFallback ? " · pilihan sementara" : ""}`;
  }

  const homeFilters = $("stockFilters");
  if ($("stockSearch")) $("stockSearch").addEventListener("input", renderInventory);
  if (homeFilters) {
    homeFilters.addEventListener("click", event => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      homeFilters.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      const filter = button.dataset.filter;
      const visible = shownCars.filter(car => {
        if (filter === "all") return true;
        if (filter === "Performance") return /amg|type r|gr86|performance|coupe/i.test(`${car.brand} ${car.model} ${car.variant} ${car.type}`);
        return String(car.type || "").toLowerCase() === filter.toLowerCase();
      });
      const visibleIds = new Set(visible.map(car => String(car.id || car.chassis_no)));
      document.querySelectorAll("#inventoryGrid .vehicle-card").forEach(card => {
        const id = card.querySelector("a[data-car-id]")?.dataset.carId || "";
        card.style.display = visibleIds.has(id) ? "" : "none";
      });
      $("stockStatus").textContent = `${visible.length} unit dipaparkan`;
    });
  }

  function applyWhatsappLinks() {
    document.querySelectorAll('[data-whatsapp="general"]').forEach(link => {
      link.href = whatsapp("Salam Izuwan Automobile, saya ingin bercakap dengan advisor tentang kereta pilihan saya.");
    });
    const floating = $("floatingWhatsapp");
    if (floating) floating.href = whatsapp("Salam Izuwan Automobile, saya ingin bertanya tentang ready stock dan pilihan kereta yang sesuai.");
  }
  applyWhatsappLinks();

  /* Deliveries band — real Supabase photos, honest fallback (spec §4.1.6) */
  function renderDeliveries(deliveries) {
    const grid = $("handoverGrid");
    if (!grid) return;
    const valid = (deliveries || []).filter(item => item.is_active !== false && media(item.photo_url)).slice(0, 5);
    if (!valid.length) {
      grid.innerHTML = `<div class="handover-placeholder"><span>IA</span><p>Real handovers, recorded by our team.</p></div><div class="handover-placeholder tall"><span>2011</span><p>Serving Malaysian car owners since 2011.</p></div><div class="handover-placeholder"><span>100%</span><p>Bumiputera recond specialist.</p></div>`;
      return;
    }
    grid.innerHTML = valid.map(item => `<article class="handover-card"><img src="${safe(media(item.photo_url))}" alt="${safe(item.title || "Serahan pelanggan Izuwan Automobile")}" loading="lazy"><div><p>${safe(item.title || item.model || "Delivered by Izuwan")}</p><small>${safe(item.model || item.location || "Taman Wahyu, Kuala Lumpur")}</small></div></article>`).join("");
  }

  let fallbackTimer = 0;
  (async () => {
    try {
      if (!window.IASBData?.configured && !window.IASBData?.sheetConfigured) throw new Error("Inventory source unavailable");
      const data = await window.IASBData.loadPublicData();
      if (data.settings?.whatsapp_number) whatsappNumber = data.settings.whatsapp_number;
      applyWhatsappLinks();
      renderDeliveries(data.deliveries);
      updateHeroChip(data.inventory, data.settings);
      const liveCars = (data.inventory || []).filter(car => car && car.is_active !== false);
      if (!liveCars.length) throw new Error("No live inventory");
      window.clearTimeout(fallbackTimer);
      inventory = liveCars;
      usingFallback = false;
      renderInventory();
    } catch (error) {
      window.clearTimeout(fallbackTimer);
      updateHeroChip(inventory, null);
      console.warn("Using fallback inventory.", error);
    }
  })();

  /* Finance calculator module — unified IASBSite.monthlyEstimate (spec §5) */
  const priceInput = $("vehiclePrice");
  const depositInput = $("downpayment");
  const rateInput = $("interestRate");
  let loanYears = 9;
  function calculateLoan() {
    if (!priceInput) return;
    const price = Number(priceInput.value);
    depositInput.max = String(Math.max(0, price * 0.5));
    if (Number(depositInput.value) > Number(depositInput.max)) depositInput.value = depositInput.max;
    const deposit = Number(depositInput.value);
    const assumptions = window.IASBSite?.financeAssumptions() || { rate: 3.2 };
    const rate = rateInput ? Number(rateInput.value) : assumptions.rate;
    const monthly = window.IASBSite.monthlyEstimate(price, { downpayment: deposit, years: loanYears, rate });
    const depositPct = price ? Math.round(deposit / price * 100) : 0;
    $("priceOutput").textContent = money(price);
    $("depositOutput").textContent = `${money(deposit)} · ${depositPct}%`;
    if (rateInput) $("rateOutput").textContent = `${rate.toFixed(1)}% p.a.`;
    $("monthlyPayment").textContent = money(monthly);
    $("financeSummary").textContent = `Pinjaman ${money(Math.max(0, price - deposit))} selama ${loanYears} tahun`;
    $("loanWhatsapp").href = whatsapp(`Salam Izuwan Automobile, saya ingin buat loan pre-check. Harga kereta: ${money(price)}, downpayment: ${money(deposit)} (${depositPct}%), tenure: ${loanYears} tahun, kadar anggaran: ${rate.toFixed(1)}% p.a., ansuran anggaran: ${money(monthly)}/bulan.`);
  }
  if (priceInput) {
    [priceInput, depositInput, rateInput].forEach(input => input?.addEventListener("input", calculateLoan));
    document.querySelector(".segment-control")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-years]");
      if (!button) return;
      loanYears = Number(button.dataset.years);
      document.querySelectorAll("[data-years]").forEach(item => item.classList.toggle("active", item === button));
      calculateLoan();
    });
    calculateLoan();
  }

  /* Select wizard dialog — contextual WhatsApp handoff (spec §3.6) */
  const dialog = $("orderDialog");
  let wizardStep = 0;
  const steps = dialog ? [...dialog.querySelectorAll(".wizard-step")] : [];
  function updateWizard() {
    steps.forEach((step, index) => step.classList.toggle("active", index === wizardStep));
    dialog.querySelectorAll(".wizard-progress i").forEach((item, index) => item.classList.toggle("active", index <= wizardStep));
    $("wizardBack").hidden = wizardStep === 0;
    $("wizardNext").hidden = wizardStep === steps.length - 1;
    $("wizardSubmit").hidden = wizardStep !== steps.length - 1;
    steps[wizardStep].querySelector("input,select")?.focus();
  }
  if (dialog) {
    $("openWizard").addEventListener("click", () => { wizardStep = 0; dialog.showModal(); updateWizard(); });
    $("closeWizard").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    $("wizardNext").addEventListener("click", () => {
      const control = steps[wizardStep].querySelector("input,select");
      if (!control.reportValidity()) return;
      wizardStep = Math.min(steps.length - 1, wizardStep + 1);
      updateWizard();
    });
    $("wizardBack").addEventListener("click", () => { wizardStep = Math.max(0, wizardStep - 1); updateWizard(); });
    $("orderForm").addEventListener("submit", event => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const message = `Salam Izuwan Automobile, saya ingin mula Japan Auction Order. Jenama: ${$("orderBrand").value}. Bajet: ${$("orderBudget").value}. Warna: ${$("orderColor").value}. Model/nota: ${$("orderModel").value}. Boleh advisor bantu semak pilihan?`;
      window.IASBLeadTracker?.track("select_programme_brief", { label: $("orderBrand").value, metadata: { budget: $("orderBudget").value, colour: $("orderColor").value, model: $("orderModel").value } });
      window.open(whatsapp(message), "_blank", "noopener");
      dialog.close();
    });
    document.querySelector(".roadmap")?.addEventListener("click", event => {
      const card = event.target.closest("article");
      if (!card) return;
      document.querySelectorAll(".roadmap article").forEach(item => item.classList.toggle("active", item === card));
    });
  }

  /* Showroom open-now status (MY time) */
  function updateHours() {
    const target = $("openStatus");
    if (!target) return;
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
    const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
    const total = hour * 60 + minute;
    const open = total >= 540 && total < 1140;
    target.textContent = open ? "Open Now" : total < 540 ? "Opens at 9:00 AM" : "Opens tomorrow at 9:00 AM";
    target.closest(".hours")?.classList.toggle("closed", !open);
  }
  updateHours();
})();
