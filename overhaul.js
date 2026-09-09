(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const media = value => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  const money = value => `RM ${Math.round(Number(value) || 0).toLocaleString("en-MY")}`;
  let whatsappNumber = window.IASB_CONFIG?.fallbackWhatsapp || "60192788667";
  const whatsapp = message => `https://wa.me/${String(whatsappNumber).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  const fallbackCars = [
    { id: "IA-88", brand: "Toyota", model: "Vellfire ZG", year: 2021, grade: "4.5", mileage: 28000, price: 238000, type: "MPV", status: "AVAILABLE", image_url: "https://lh3.googleusercontent.com/d/11-CSqtcyreeQSHcptqQDBuOrRI5SsjZf=w1200" },
    { id: "IA-64", brand: "Toyota", model: "Harrier Z", year: 2022, grade: "4.5", mileage: 19000, price: 218000, type: "SUV", status: "INCOMING", image_url: "https://lh3.googleusercontent.com/d/1mD93FTs9Z1LexsmP_5k7xDqvDT4nkFhv=w1200" },
    { id: "IA-35", brand: "Mercedes-AMG", model: "GLA 35 4MATIC", year: 2021, grade: "4.5", mileage: 24000, price: 268000, type: "Performance", status: "AVAILABLE", image_url: "https://lh3.googleusercontent.com/d/1NMuq5N0jvLAZczsZ9_cJtm-HahwxgsPV=w1200" },
    { id: "IA-41", brand: "Lexus", model: "RX 300 F Sport", year: 2021, grade: "5", mileage: 21000, price: 298000, type: "SUV", status: "BOOKED", image_url: "https://lh3.googleusercontent.com/d/1MPY2LwBR8xW3Kw4Rsl6K0HfUggK-q7tK=w1200" },
    { id: "IA-72", brand: "Toyota", model: "Alphard SC", year: 2020, grade: "4.5", mileage: 33000, price: 228000, type: "MPV", status: "AVAILABLE", image_url: "https://lh3.googleusercontent.com/d/1gkoDGY2cC-9g3gjF561OAZdpcjtH-XFT=w1200" },
    { id: "IA-19", brand: "Honda", model: "Civic Type R FL5", year: 2023, grade: "5", mileage: 8000, price: 338000, type: "Performance", status: "INCOMING", image_url: "https://lh3.googleusercontent.com/d/18P9WuLWBhEA6N5OpnkghWeZBDmdwy7ZM=w1200" }
  ];
  let inventory = fallbackCars;
  let activeFilter = "all";
  let usingFallback = true;

  const statusInfo = value => {
    const key = String(value || "AVAILABLE").toUpperCase();
    if (["BOOKED", "RESERVED", "SOLD"].includes(key)) return { label: key === "SOLD" ? "Sold" : "Booked", className: "status-booked" };
    if (["INCOMING", "PORT KLANG"].includes(key)) return { label: "In Transit", className: "" };
    return { label: "Ready Stock", className: "status-ready" };
  };
  const monthly = price => {
    const principal = Math.max(0, Number(price) * .9);
    return Math.round((principal + principal * .025 * 9) / 108);
  };
  const stockRef = car => String(car.marketing_label || car.id || car.chassis_no || "IA-STOCK").replace(/^sheet:/, "").slice(0, 18);

  function vehicleCard(car) {
    const name = [car.brand, car.model].filter(Boolean).join(" ");
    const photo = media(car.image_url || car.gallery_urls?.[0]);
    const state = statusInfo(car.status);
    const price = Number(car.price) >= 10000 ? money(car.price) : "Price on request";
    const perMonth = Number(car.price) >= 10000 ? `From ${money(monthly(car.price))}/mo` : "Ask for finance estimate";
    const reference = stockRef(car);
    const message = `Salam Izuwan Automobile, saya berminat tengok unit ${name}${car.year ? ` ${car.year}` : ""} (Ref: ${reference}). Unit masih available?`;
    const detailHref = car.id ? `/car?id=${encodeURIComponent(car.id)}` : "/inventory";
    return `<article class="vehicle-card" data-type="${safe(car.type || "Other")}">
      <a class="vehicle-media" href="${detailHref}" aria-label="Lihat ${safe(name)}">${photo ? `<img src="${safe(photo)}" alt="${safe(name)}" loading="lazy">` : `<span class="vehicle-placeholder">${safe(car.brand || "IZUWAN")}</span>`}<span class="status-tag ${state.className}">${state.label}</span><span class="grade-badge">GRADE ${safe(car.grade || "CHECK")}</span></a>
      <div class="vehicle-body"><p class="vehicle-ref">${safe(reference)} · ${safe(car.type || "Japan Recond")}</p><h3><a href="${detailHref}">${safe(name)}</a></h3><div class="vehicle-specs"><span>${safe(car.year || "Year on request")}</span><span>${Number(car.mileage) > 0 ? `${Number(car.mileage).toLocaleString("en-MY")} km` : "Mileage on request"}</span></div><div class="vehicle-price"><span><strong>${price}</strong><small>${perMonth}</small></span><a href="${safe(whatsapp(message))}" target="_blank" rel="noopener">WhatsApp ↗</a></div></div>
    </article>`;
  }

  function renderInventory() {
    const term = $("stockSearch").value.trim().toLowerCase();
    const shown = inventory.filter(car => {
      const haystack = [car.brand, car.model, car.variant, car.year].join(" ").toLowerCase();
      const type = String(car.type || "").toLowerCase();
      const categoryMatch = activeFilter === "all" || type.includes(activeFilter.toLowerCase()) || (activeFilter === "Performance" && /amg|type r|gr86|performance/i.test(haystack));
      return categoryMatch && (!term || haystack.includes(term));
    }).slice(0, 6);
    $("inventoryGrid").setAttribute("aria-busy", "false");
    $("inventoryGrid").innerHTML = shown.length ? shown.map(vehicleCard).join("") : `<div class="empty-stock"><h3>Belum jumpa model itu.</h3><p>WhatsApp advisor dan kami akan semak ready stock atau carikan dari Jepun.</p><a class="button button-primary" href="${safe(whatsapp("Salam Izuwan Automobile, boleh bantu cari kereta mengikut spesifikasi dan bajet saya?"))}" target="_blank" rel="noopener">Bantu saya cari ↗</a></div>`;
    $("stockStatus").textContent = `${shown.length} unit dipaparkan${usingFallback ? " · pilihan sementara" : ""}`;
  }

  $("stockSearch").addEventListener("input", renderInventory);
  $("stockFilters").addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    $("stockFilters").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    renderInventory();
  });

  function applyWhatsappLinks() {
    document.querySelectorAll('[data-whatsapp="general"]').forEach(link => {
      link.href = whatsapp("Salam Izuwan Automobile, saya ingin bercakap dengan advisor tentang kereta pilihan saya.");
    });
    $("floatingWhatsapp").href = whatsapp("Salam Izuwan Automobile, saya ingin bertanya tentang ready stock dan pilihan kereta yang sesuai.");
  }
  applyWhatsappLinks();

  let fallbackShown = false;
  const fallbackTimer = window.setTimeout(() => {
    fallbackShown = true;
    usingFallback = true;
    inventory = fallbackCars;
    renderInventory();
  }, 1500);

  function renderDeliveries(deliveries) {
    const valid = (deliveries || []).filter(item => item.is_active !== false && media(item.photo_url)).slice(0, 5);
    if (!valid.length) {
      $("handoverGrid").innerHTML = `<div class="handover-placeholder"><span>IA</span><p>Real handovers, recorded by our team.</p></div><div class="handover-placeholder tall"><span>2011</span><p>Serving Malaysian car owners since 2011.</p></div><div class="handover-placeholder"><span>100%</span><p>Bumiputera recond specialist.</p></div>`;
      return;
    }
    $("handoverGrid").innerHTML = valid.map(item => `<article class="handover-card"><img src="${safe(media(item.photo_url))}" alt="${safe(item.title || "Serahan pelanggan Izuwan Automobile")}" loading="lazy"><div><p>${safe(item.title || item.model || "Delivered by Izuwan")}</p><small>${safe(item.model || item.location || "Taman Wahyu, Kuala Lumpur")}</small></div></article>`).join("");
  }

  (async () => {
    try {
      if (!window.IASBData?.configured && !window.IASBData?.sheetConfigured) throw new Error("Inventory source unavailable");
      const data = await window.IASBData.loadPublicData();
      const liveCars = (data.inventory || []).filter(car => car && car.is_active !== false).sort((a, b) => Number(Boolean(b.image_url || b.gallery_urls?.[0])) - Number(Boolean(a.image_url || a.gallery_urls?.[0])) || Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));
      if (data.settings?.whatsapp_number) whatsappNumber = data.settings.whatsapp_number;
      applyWhatsappLinks();
      renderDeliveries(data.deliveries);
      if (!liveCars.length) throw new Error("No live inventory");
      window.clearTimeout(fallbackTimer);
      inventory = liveCars;
      usingFallback = false;
      renderInventory();
    } catch (error) {
      window.clearTimeout(fallbackTimer);
      if (!fallbackShown) { inventory = fallbackCars; usingFallback = true; renderInventory(); }
      console.warn("Using fallback inventory.", error);
    }
  })();

  const priceInput = $("vehiclePrice");
  const depositInput = $("downpayment");
  const rateInput = $("interestRate");
  let loanYears = 9;
  function updateSliderFill(input) {
    const value = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.background = `linear-gradient(90deg, #e11d48 ${value}%, #3f3f46 ${value}%)`;
  }
  function calculateLoan() {
    const price = Number(priceInput.value);
    depositInput.max = String(Math.max(0, price * .5));
    if (Number(depositInput.value) > Number(depositInput.max)) depositInput.value = depositInput.max;
    const deposit = Number(depositInput.value);
    const rate = Number(rateInput.value);
    const principal = Math.max(0, price - deposit);
    const installment = Math.round((principal + principal * (rate / 100) * loanYears) / (loanYears * 12));
    const depositPct = price ? Math.round(deposit / price * 100) : 0;
    $("priceOutput").textContent = money(price);
    $("depositOutput").textContent = `${money(deposit)} · ${depositPct}%`;
    $("rateOutput").textContent = `${rate.toFixed(1)}% p.a.`;
    $("monthlyPayment").textContent = money(installment);
    $("financeSummary").textContent = `Financing ${money(principal)} over ${loanYears} years`;
    $("loanWhatsapp").href = whatsapp(`Salam Izuwan Automobile, saya ingin buat loan pre-check. Harga kereta: ${money(price)}, downpayment: ${money(deposit)} (${depositPct}%), tenure: ${loanYears} tahun, kadar anggaran: ${rate.toFixed(1)}% p.a., ansuran anggaran: ${money(installment)}/bulan.`);
    [priceInput, depositInput, rateInput].forEach(updateSliderFill);
  }
  [priceInput, depositInput, rateInput].forEach(input => input.addEventListener("input", calculateLoan));
  document.querySelector(".segment-control").addEventListener("click", event => {
    const button = event.target.closest("button[data-years]");
    if (!button) return;
    loanYears = Number(button.dataset.years);
    document.querySelectorAll("[data-years]").forEach(item => item.classList.toggle("active", item === button));
    calculateLoan();
  });
  calculateLoan();

  const dialog = $("orderDialog");
  let wizardStep = 0;
  const steps = [...dialog.querySelectorAll(".wizard-step")];
  function updateWizard() {
    steps.forEach((step, index) => step.classList.toggle("active", index === wizardStep));
    dialog.querySelectorAll(".wizard-progress i").forEach((item, index) => item.classList.toggle("active", index <= wizardStep));
    $("wizardBack").hidden = wizardStep === 0;
    $("wizardNext").hidden = wizardStep === steps.length - 1;
    $("wizardSubmit").hidden = wizardStep !== steps.length - 1;
    steps[wizardStep].querySelector("input,select")?.focus();
  }
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
    window.open(whatsapp(message), "_blank", "noopener");
    dialog.close();
  });

  document.querySelector(".roadmap").addEventListener("click", event => {
    const card = event.target.closest("article");
    if (!card) return;
    document.querySelectorAll(".roadmap article").forEach(item => item.classList.toggle("active", item === card));
  });

  function updateHours() {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
    const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
    const total = hour * 60 + minute;
    const open = total >= 540 && total < 1140;
    $("openStatus").textContent = open ? "Open Now" : total < 540 ? "Opens at 9:00 AM" : "Opens tomorrow at 9:00 AM";
    $("openStatus").closest(".hours").classList.toggle("closed", !open);
  }
  updateHours();

  const header = $("siteHeader");
  const menuButton = $("menuButton");
  const mainNav = $("mainNav");
  const scrollUi = () => header.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", scrollUi, { passive: true });
  scrollUi();
  menuButton.addEventListener("click", () => { const open = mainNav.classList.toggle("open"); menuButton.setAttribute("aria-expanded", String(open)); });
  mainNav.addEventListener("click", () => { mainNav.classList.remove("open"); menuButton.setAttribute("aria-expanded", "false"); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && mainNav.classList.contains("open")) { mainNav.classList.remove("open"); menuButton.setAttribute("aria-expanded", "false"); menuButton.focus(); } });
})();
