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

  const { renderCard, money } = window.IASBCards;
  const activeCars = cars => (Array.isArray(cars) ? cars : []).filter(car => car && car.is_active !== false);
  const isAvailable = car => ["AVAILABLE", "READY STOCK"].includes(String(car.status || "").trim().toUpperCase());
  const unitCount = car => {
    const value = Number(car.units);
    return Number.isFinite(value) && value >= 0 && car.units !== null && car.units !== ""
      ? Math.floor(value)
      : 1;
  };

  /* Only explicitly available stock contributes to the ready-stock count. */
  function updateHeroChip(cars, settings) {
    const chip = $("heroLiveChip");
    if (!chip) return;
    const live = activeCars(cars);
    const units = live.filter(isAvailable).reduce((sum, car) => sum + unitCount(car), 0);
    const pricelist = settings?.pricelist_date || live.find(car => car.campaign_tag)?.campaign_tag?.replace(/^PRICELIST\s*/i, "") || "";
    chip.innerHTML = `<i aria-hidden="true"></i><b>${units.toLocaleString("en-MY")} unit</b> ready stock${pricelist ? ` · PRICELIST ${safe(pricelist)}` : ""}`;
  }

  /* Curate only the default view. Search and filters use every active row. */
  function pickFeatured(cars) {
    const hasPhoto = car => Boolean(media(car.image_url) || (Array.isArray(car.gallery_urls) ? car.gallery_urls : []).some(media));
    const live = activeCars(cars);
    const withPhotos = live.filter(hasPhoto);
    const withoutPhotos = live.filter(car => !hasPhoto(car));
    const picked = new Map();
    const add = car => {
      const key = car?.id || car?.chassis_no || car;
      if (car && !picked.has(key)) picked.set(key, car);
    };
    const addGroup = group => {
      group.filter(car => car.is_featured).slice(0, 3).forEach(add);
      const ladder = [...group].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      if (ladder.length) add(ladder[0]);
      if (ladder.length > 2) add(ladder[Math.floor(ladder.length / 2)]);
      if (ladder.length > 1) add(ladder[ladder.length - 1]);
      group.forEach(add);
    };
    addGroup(withPhotos);
    addGroup(withoutPhotos);
    return [...picked.values()].slice(0, 6);
  }

  let inventory = [];
  let activeFilter = "all";
  let inventoryState = "loading";
  let loadingInventory = false;
  const homeFilters = $("stockFilters");

  function updateFilterButtons() {
    homeFilters?.querySelectorAll("button[data-filter]").forEach(button => {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function matchesType(car) {
    if (activeFilter === "all") return true;
    if (activeFilter === "Performance") return /amg|type r|gr\s?86|performance|coupe/i.test(`${car.brand} ${car.model} ${car.variant} ${car.type}`);
    return String(car.type || "").toLowerCase() === activeFilter.toLowerCase();
  }

  function setStockStatus(message) {
    if ($("stockStatus")) $("stockStatus").textContent = message;
  }

  function renderInventory() {
    const grid = $("inventoryGrid");
    if (!grid) return;
    updateFilterButtons();
    grid.setAttribute("aria-busy", String(inventoryState === "loading"));
    if (inventoryState === "loading") {
      grid.innerHTML = '<div class="stock-skeleton" aria-hidden="true"></div>'.repeat(3);
      setStockStatus("Memuatkan koleksi…");
      return;
    }
    if (inventoryState === "error") {
      grid.innerHTML = `<div class="empty-stock inventory-error"><h3>Stok belum dapat dimuatkan.</h3><p>Sambungan ke senarai stok terganggu. Cuba lagi atau hubungi advisor untuk semakan terkini.</p><div class="stock-state-actions"><button class="button button-primary" type="button" data-stock-retry>Cuba lagi ↻</button><a class="button button-ghost" href="${safe(whatsapp("Salam Izuwan Automobile, saya ingin semak senarai stok terkini."))}" target="_blank" rel="noopener">WhatsApp advisor ↗</a></div></div>`;
      setStockStatus("Stok tidak dapat dimuatkan");
      return;
    }
    const term = ($("stockSearch")?.value || "").trim().toLowerCase();
    const filtered = inventory.filter(matchesType).filter(car => !term || [
      car.brand, car.model, car.variant, car.year, car.type, car.exterior_color,
      car.location, car.marketing_label, car.chassis_no
    ].join(" ").toLowerCase().includes(term));
    const isFiltered = Boolean(term || activeFilter !== "all");
    const shownCars = isFiltered ? filtered : pickFeatured(filtered);
    if (!shownCars.length) {
      const emptyInventory = inventory.length === 0;
      grid.innerHTML = `<div class="empty-stock"><h3>${emptyInventory ? "Koleksi sedang dikemaskini." : "Belum jumpa padanan itu."}</h3><p>${emptyInventory ? "Tiada unit aktif dipaparkan buat masa ini. Hubungi advisor untuk semakan stok atau pilihan sourcing." : "Cuba model atau kategori lain, atau minta advisor bantu carikan unit pilihan anda."}</p><div class="stock-state-actions">${isFiltered ? '<button class="button button-primary" type="button" data-stock-reset>Reset carian</button>' : ''}<a class="button ${isFiltered ? "button-ghost" : "button-primary"}" href="${safe(whatsapp("Salam Izuwan Automobile, boleh bantu cari kereta mengikut spesifikasi dan bajet saya?"))}" target="_blank" rel="noopener">Bantu saya cari ↗</a></div></div>`;
      setStockStatus(emptyInventory ? "Tiada unit aktif buat masa ini" : "Tiada padanan · cuba reset carian");
      return;
    }
    grid.innerHTML = shownCars.map(car => renderCard(car, { hrefBase: "car.html" })).join("");
    setStockStatus(isFiltered
      ? `${filtered.length} pilihan ditemui`
      : `${shownCars.length} daripada ${inventory.length} pilihan dipaparkan`);
  }

  $("stockSearch")?.addEventListener("input", renderInventory);
  homeFilters?.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button || !homeFilters.contains(button)) return;
    activeFilter = button.dataset.filter;
    renderInventory();
  });
  $("inventoryGrid")?.addEventListener("click", event => {
    if (event.target.closest("[data-stock-retry]")) loadInventory(true);
    if (event.target.closest("[data-stock-reset]")) {
      activeFilter = "all";
      if ($("stockSearch")) $("stockSearch").value = "";
      renderInventory();
      $("stockSearch")?.focus();
    }
  });
  updateFilterButtons();

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
    if ($("handover")) $("handover").hidden = !valid.length;
    if (!valid.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = valid.map(item => `<article class="handover-card"><img src="${safe(media(item.photo_url))}" alt="${safe(item.title || "Serahan pelanggan Izuwan Automobile")}" loading="lazy"><div><p>${safe(item.title || item.model || "Delivered by Izuwan")}</p><small>${safe(item.model || item.location || "Taman Wahyu, Kuala Lumpur")}</small></div></article>`).join("");
  }

  /* Reuse the shell's request, including when it completed before this script
     loaded. A retry clears only the completed/failed request, never an in-flight one. */
  async function loadInventory(force = false) {
    if (loadingInventory) return;
    loadingInventory = true;
    inventoryState = "loading";
    renderInventory();
    if ($("heroLiveChip")) $("heroLiveChip").textContent = "Menyemak stok terkini…";
    try {
      const data = await window.IASBSite.loadManagedData({ force });
      if (!Array.isArray(data?.inventory) || data.inventorySource === "none") throw new Error("Inventory source unavailable");
      if (data.settings?.whatsapp_number) whatsappNumber = data.settings.whatsapp_number;
      applyWhatsappLinks();
      renderDeliveries(data.deliveries);
      inventory = activeCars(data.inventory);
      inventoryState = "ready";
      updateHeroChip(inventory, data.settings);
      renderInventory();
      calculateLoan();
    } catch (error) {
      inventoryState = "error";
      renderInventory();
      renderDeliveries([]);
      if ($("heroLiveChip")) $("heroLiveChip").textContent = "Semakan stok tidak tersedia";
      console.warn("Homepage inventory unavailable.", error);
    } finally {
      loadingInventory = false;
    }
  }
  loadInventory();

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
    document.querySelectorAll("[data-years]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.years) === loanYears));
    });
    [priceInput, depositInput, rateInput].forEach(input => input?.addEventListener("input", calculateLoan));
    document.querySelector(".segment-control")?.addEventListener("click", event => {
      const button = event.target.closest("button[data-years]");
      if (!button) return;
      loanYears = Number(button.dataset.years);
      document.querySelectorAll("[data-years]").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
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
