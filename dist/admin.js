const dataApi = window.IASBData;
const db = dataApi?.client;
const $ = id => document.getElementById(id);
let inventoryRows = [];
let salesmanRows = [];
let eventRows = [];
let settingsRow = {};
let schemaWarnings = [];

function toast(message) {
  $("adminToast").textContent = message;
  $("adminToast").classList.add("show");
  setTimeout(() => $("adminToast").classList.remove("show"), 2200);
}

function money(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY")}`;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? fallback);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function km(value) {
  return Number(value) > 0 ? `${Number(value).toLocaleString("en-MY")} km` : "-";
}

function formatDate(value) {
  if (!value) return "Open date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function eventIsLive(event) {
  if (!event?.is_active) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = event.start_date ? new Date(`${event.start_date}T00:00:00`) : null;
  const end = event.end_date ? new Date(`${event.end_date}T23:59:59`) : null;
  return (!start || start <= today) && (!end || end >= today);
}

function eventStatus(event) {
  if (!event.is_active) return "INACTIVE";
  if (eventIsLive(event)) return "LIVE";
  const today = new Date();
  const start = event.start_date ? new Date(`${event.start_date}T00:00:00`) : null;
  if (start && start > today) return "SCHEDULED";
  return "ENDED";
}

async function readQuery(label, query, fallback) {
  const { data, error } = await query;
  if (error) {
    schemaWarnings.push(`${label}: ${error.message}`);
    return fallback;
  }
  return data ?? fallback;
}

async function verifyAdmin() {
  if (!db) return false;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const { data } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}

async function showApp() {
  $("loginView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
  await loadAll();
}

async function loadAll() {
  schemaWarnings = [];
  const [inventoryData, settingsData, salesmenData, eventsData] = await Promise.all([
    readQuery("Inventory", db.from("inventory").select("*").order("updated_at", { ascending: false }), []),
    readQuery("Settings", db.from("site_settings").select("*").eq("id", 1).maybeSingle(), {}),
    readQuery("Salesmen", db.from("salesmen").select("*").order("name"), []),
    readQuery("Events", db.from("site_events").select("*").order("start_date", { ascending: false }), [])
  ]);
  inventoryRows = inventoryData;
  settingsRow = settingsData || {};
  salesmanRows = salesmenData;
  eventRows = eventsData;
  renderDashboard();
  renderInventory();
  renderSettings();
  renderSalesmen();
  renderEvents();
  if (schemaWarnings.length) toast("Ada schema baru belum aktif. Run supabase-schema.sql jika perlu.");
}

function renderDashboard() {
  const activeCars = inventoryRows.filter(x => x.is_active);
  $("statUnits").textContent = activeCars.reduce((sum, x) => sum + Number(x.units || 1), 0);
  $("statModels").textContent = activeCars.length;
  $("statIncoming").textContent = activeCars.filter(x => x.status === "INCOMING").reduce((sum, x) => sum + Number(x.units || 1), 0);
  $("statSalesmen").textContent = salesmanRows.filter(x => x.is_active).length;

  const statuses = Object.entries(activeCars.reduce((acc, car) => {
    acc[car.status || "UNKNOWN"] = (acc[car.status || "UNKNOWN"] || 0) + Number(car.units || 1);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  $("overviewBreakdown").innerHTML = statuses.map(([name, count]) => `<div><span>${safeText(name)}</span><b>${count} unit</b></div>`).join("") || "<p>Belum ada inventory.</p>";

  const liveEvent = eventRows.find(eventIsLive);
  $("eventSummary").innerHTML = liveEvent ? `
    <span class="status-chip">LIVE NOW</span>
    <h3>${safeText(liveEvent.title)}</h3>
    <p>${safeText(liveEvent.subtitle || liveEvent.description || "Event sedang berlangsung.")}</p>
    <small>${formatDate(liveEvent.start_date)} – ${formatDate(liveEvent.end_date)} · ${safeText(liveEvent.location || "Online / HQ")}</small>
  ` : `
    <span class="status-chip">NO LIVE EVENT</span>
    <h3>Tiada campaign aktif sekarang.</h3>
    <p>Tambah e-carnival atau promo untuk paparkan banner automatik di website.</p>
  `;
}

function filteredInventory() {
  const search = $("adminStockSearch").value.trim().toLowerCase();
  const status = $("adminStockStatus").value;
  return inventoryRows.filter(car =>
    (status === "all" || car.status === status) &&
    (!search || [car.brand, car.model, car.variant, car.grade, car.year, car.location].join(" ").toLowerCase().includes(search))
  );
}

function renderInventory() {
  $("inventoryTable").innerHTML = filteredInventory().map(car => `
    <tr>
      <td class="table-main">
        <b>${safeText(car.brand)} ${safeText(car.model)} ${car.is_featured ? '<span class="mini-badge">FEATURED</span>' : ""}</b>
        <small>${safeText([car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "-")}</small>
      </td>
      <td>${safeText(car.location)}</td>
      <td><span class="status-chip">${safeText(car.is_active ? car.status : "HIDDEN")}</span></td>
      <td>${money(car.price)}</td>
      <td>${km(car.mileage)}</td>
      <td>${Number(car.units || 1)}</td>
      <td><div class="row-actions"><button data-edit-car="${car.id}">Edit</button><button class="danger" data-delete-car="${car.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="7">Tiada stok dijumpai.</td></tr>`;
}

function renderSettings() {
  $("settingCompany").value = settingsRow.company_name || "";
  $("settingDate").value = settingsRow.pricelist_date || "";
  $("settingProcessing").value = settingsRow.processing_fee || 0;
  $("settingRegistration").value = settingsRow.registration_fee || 0;
  $("settingInterest").value = settingsRow.default_interest || 3.2;
  $("settingDsr").value = settingsRow.default_dsr || 60;
  $("settingWhatsapp").value = settingsRow.whatsapp_number || "";
  $("settingBanner").value = settingsRow.promotion_banner || "";
  $("logoPreview").innerHTML = settingsRow.logo_url ? `<img src="${safeText(settingsRow.logo_url)}" alt="Logo">` : "Belum ada logo";
}

function renderSalesmen() {
  $("salesmenTable").innerHTML = salesmanRows.map(person => `
    <tr>
      <td class="table-main"><b>${safeText(person.name)}</b><small>${safeText(person.role || "Sales Advisor")} · ${safeText(person.specialty || person.branch || "-")}</small></td>
      <td>${safeText(person.whatsapp)}</td><td>${safeText(person.branch)}</td>
      <td><span class="status-chip">${person.is_active ? "ACTIVE" : "INACTIVE"}</span></td>
      <td><div class="row-actions"><button data-edit-salesman="${person.id}">Edit</button><button class="danger" data-delete-salesman="${person.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="5">Belum ada salesman.</td></tr>`;
}

function renderEvents() {
  $("eventsTable").innerHTML = eventRows.map(event => `
    <tr>
      <td class="table-main"><b>${safeText(event.title)}</b><small>${safeText(event.subtitle || event.location || "-")}</small></td>
      <td>${formatDate(event.start_date)} – ${formatDate(event.end_date)}</td>
      <td>${safeText(event.cta_label || "WhatsApp")}</td>
      <td><span class="status-chip">${eventStatus(event)}</span></td>
      <td><div class="row-actions"><button data-edit-event="${event.id}">Edit</button><button class="danger" data-delete-event="${event.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="5">Belum ada event. Tambah e-carnival stock clearance di sini.</td></tr>`;
}

function openCarDialog(car = {}) {
  $("carDialogTitle").textContent = car.id ? "Edit stok" : "Tambah stok";
  $("carId").value = car.id || "";
  $("carBrand").value = car.brand || "";
  $("carModel").value = car.model || "";
  $("carYear").value = car.year || "";
  $("carGrade").value = car.grade || "";
  $("carVariant").value = car.variant || "";
  $("carType").value = car.type || "MPV";
  $("carAdminPrice").value = car.price || "";
  $("carMileage").value = car.mileage || "";
  $("carStatus").value = car.status || "AVAILABLE";
  $("carLocation").value = car.location || "";
  $("carUnits").value = car.units || 1;
  $("carImageUrl").value = car.image_url || "";
  $("carActive").checked = car.is_active ?? true;
  $("carFeatured").checked = Boolean(car.is_featured);
  $("carDialog").showModal();
}

function openSalesmanDialog(person = {}) {
  $("salesmanDialogTitle").textContent = person.id ? "Edit salesman" : "Tambah salesman";
  $("salesmanId").value = person.id || "";
  $("salesmanName").value = person.name || "";
  $("salesmanWhatsapp").value = person.whatsapp || "";
  $("salesmanBranch").value = person.branch || "";
  $("salesmanRole").value = person.role || "Sales Advisor";
  $("salesmanSpecialty").value = person.specialty || "";
  $("salesmanPhotoUrl").value = person.photo_url || "";
  $("salesmanActive").checked = person.is_active ?? true;
  $("salesmanDialog").showModal();
}

function openEventDialog(event = {}) {
  $("eventDialogTitle").textContent = event.id ? "Edit event" : "Tambah event";
  $("eventId").value = event.id || "";
  $("eventTitle").value = event.title || "";
  $("eventKicker").value = event.kicker || "";
  $("eventSubtitle").value = event.subtitle || "";
  $("eventDescription").value = event.description || "";
  $("eventStart").value = event.start_date || "";
  $("eventEnd").value = event.end_date || "";
  $("eventLocation").value = event.location || "";
  $("eventCtaLabel").value = event.cta_label || "WhatsApp untuk info lanjut";
  $("eventCtaMessage").value = event.cta_message || "";
  $("eventBannerUrl").value = event.banner_url || "";
  $("eventBannerFile").value = "";
  $("eventActive").checked = event.is_active ?? true;
  $("eventDialog").showModal();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginMessage").textContent = "";
  if (!db) return $("loginMessage").textContent = "Supabase belum disambungkan.";
  const { error } = await db.auth.signInWithPassword({
    email: $("loginEmail").value,
    password: $("loginPassword").value
  });
  if (error) return $("loginMessage").textContent = error.message;
  if (!await verifyAdmin()) {
    await db.auth.signOut();
    return $("loginMessage").textContent = "Akaun ini bukan admin.";
  }
  await showApp();
});

$("logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

document.querySelectorAll(".admin-nav").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".admin-nav").forEach(x => x.classList.toggle("active", x === button));
  document.querySelectorAll(".admin-page").forEach(x => x.classList.toggle("active", x.dataset.pagePanel === button.dataset.page));
  $("pageTitle").textContent = button.textContent;
  document.querySelector(".admin-sidebar").classList.remove("open");
}));

$("mobileMenu").addEventListener("click", () => document.querySelector(".admin-sidebar").classList.toggle("open"));
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => {
  $(button.dataset.closeDialog).close();
}));
$("adminStockSearch").addEventListener("input", renderInventory);
$("adminStockStatus").addEventListener("change", renderInventory);
$("addCarButton").addEventListener("click", () => openCarDialog());
$("addSalesmanButton").addEventListener("click", () => openSalesmanDialog());
$("addEventButton").addEventListener("click", () => openEventDialog({ title: "E-Carnival Stock Clearance", kicker: "SPECIAL EVENT", cta_label: "WhatsApp untuk info lanjut" }));
$("importStarterButton").addEventListener("click", async () => {
  if (inventoryRows.length && !confirm("Inventory sudah ada. Import juga stok asal?")) return;
  const payload = (window.inventoryData || []).map(car => ({
    brand: car.brand, model: car.model, variant: car.variant, type: car.type,
    price: car.price, status: car.status, location: car.location,
    units: car.units, is_active: true
  }));
  if (!payload.length) return toast("Data stok asal tiada");
  const { error } = await db.from("inventory").insert(payload);
  if (error) return toast(error.message);
  toast(`${payload.length} stok diimport`);
  await loadAll();
});

$("inventoryTable").addEventListener("click", async event => {
  const editId = event.target.dataset.editCar;
  const deleteId = event.target.dataset.deleteCar;
  if (editId) openCarDialog(inventoryRows.find(x => x.id === Number(editId)));
  if (deleteId && confirm("Delete stok ini?")) {
    const { error } = await db.from("inventory").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Stok dipadam");
    await loadAll();
  }
});

$("eventsTable").addEventListener("click", async event => {
  const editId = event.target.dataset.editEvent;
  const deleteId = event.target.dataset.deleteEvent;
  if (editId) openEventDialog(eventRows.find(x => x.id === Number(editId)));
  if (deleteId && confirm("Delete event ini?")) {
    const { error } = await db.from("site_events").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Event dipadam");
    await loadAll();
  }
});

$("carForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("carId").value;
  const payload = {
    brand: $("carBrand").value.trim(),
    model: $("carModel").value.trim(),
    year: $("carYear").value ? Number($("carYear").value) : null,
    grade: $("carGrade").value.trim(),
    variant: $("carVariant").value.trim(),
    type: $("carType").value,
    price: Number($("carAdminPrice").value),
    mileage: $("carMileage").value ? Number($("carMileage").value) : null,
    status: $("carStatus").value,
    location: $("carLocation").value.trim(),
    units: Number($("carUnits").value) || 1,
    image_url: $("carImageUrl").value.trim(),
    is_featured: $("carFeatured").checked,
    is_active: $("carActive").checked,
    updated_at: new Date().toISOString()
  };
  const query = id ? db.from("inventory").update(payload).eq("id", id) : db.from("inventory").insert(payload);
  const { error } = await query;
  if (error) return toast(error.message);
  $("carDialog").close();
  toast(id ? "Stok dikemas kini" : "Stok ditambah");
  await loadAll();
});

$("eventForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("eventId").value;
  let bannerUrl = $("eventBannerUrl").value.trim();
  const file = $("eventBannerFile").files[0];
  if (file) {
    const extension = file.name.split(".").pop();
    const path = `events/event-${Date.now()}.${extension}`;
    const { error: uploadError } = await db.storage.from("branding").upload(path, file, { upsert: true });
    if (uploadError) return toast(uploadError.message);
    bannerUrl = db.storage.from("branding").getPublicUrl(path).data.publicUrl;
  }
  const payload = {
    title: $("eventTitle").value.trim(),
    kicker: $("eventKicker").value.trim(),
    subtitle: $("eventSubtitle").value.trim(),
    description: $("eventDescription").value.trim(),
    start_date: $("eventStart").value || null,
    end_date: $("eventEnd").value || null,
    location: $("eventLocation").value.trim(),
    cta_label: $("eventCtaLabel").value.trim() || "WhatsApp untuk info lanjut",
    cta_message: $("eventCtaMessage").value.trim(),
    banner_url: bannerUrl,
    is_active: $("eventActive").checked,
    updated_at: new Date().toISOString()
  };
  const query = id ? db.from("site_events").update(payload).eq("id", id) : db.from("site_events").insert(payload);
  const { error } = await query;
  if (error) return toast(error.message);
  $("eventDialog").close();
  toast(id ? "Event dikemas kini" : "Event ditambah");
  await loadAll();
});

$("settingsForm").addEventListener("submit", async event => {
  event.preventDefault();
  let logoUrl = settingsRow.logo_url || "";
  const file = $("settingLogo").files[0];
  if (file) {
    const extension = file.name.split(".").pop();
    const path = `company-logo.${extension}`;
    const { error: uploadError } = await db.storage.from("branding").upload(path, file, { upsert: true });
    if (uploadError) return toast(uploadError.message);
    logoUrl = db.storage.from("branding").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
  }
  const payload = {
    id: 1,
    company_name: $("settingCompany").value.trim(),
    pricelist_date: $("settingDate").value.trim(),
    processing_fee: Number($("settingProcessing").value),
    registration_fee: Number($("settingRegistration").value),
    default_interest: Number($("settingInterest").value),
    default_dsr: Number($("settingDsr").value),
    whatsapp_number: $("settingWhatsapp").value.trim(),
    promotion_banner: $("settingBanner").value.trim(),
    logo_url: logoUrl,
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from("site_settings").upsert(payload);
  if (error) return toast(error.message);
  toast("Tetapan disimpan");
  await loadAll();
});

$("salesmenTable").addEventListener("click", async event => {
  const editId = event.target.dataset.editSalesman;
  const deleteId = event.target.dataset.deleteSalesman;
  if (editId) openSalesmanDialog(salesmanRows.find(x => x.id === Number(editId)));
  if (deleteId && confirm("Delete salesman ini?")) {
    const { error } = await db.from("salesmen").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Salesman dipadam");
    await loadAll();
  }
});

$("salesmanForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("salesmanId").value;
  const payload = {
    name: $("salesmanName").value.trim(),
    whatsapp: $("salesmanWhatsapp").value.trim(),
    branch: $("salesmanBranch").value.trim(),
    role: $("salesmanRole").value.trim() || "Sales Advisor",
    specialty: $("salesmanSpecialty").value.trim(),
    photo_url: $("salesmanPhotoUrl").value.trim(),
    is_active: $("salesmanActive").checked
  };
  const query = id ? db.from("salesmen").update(payload).eq("id", id) : db.from("salesmen").insert(payload);
  const { error } = await query;
  if (error) return toast(error.message);
  $("salesmanDialog").close();
  toast(id ? "Salesman dikemas kini" : "Salesman ditambah");
  await loadAll();
});

(async function init() {
  if (!db) {
    $("setupWarning").classList.remove("hidden");
    return;
  }
  if (await verifyAdmin()) await showApp();
})();
