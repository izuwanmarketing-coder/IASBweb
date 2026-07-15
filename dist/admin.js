const dataApi = window.IASBData;
const db = dataApi?.client;
const $ = id => document.getElementById(id);
let inventoryRows = [];
let salesmanRows = [];
let eventRows = [];
let deliveryRows = [];
let leadRows = [];
let settingsRow = {};
let schemaWarnings = [];
const selectedInventoryIds = new Set();
let parsedPricelistRows = [];
let photoManagerCarId = null;

function toast(message) {
  $("adminToast").textContent = message;
  $("adminToast").classList.add("show");
  setTimeout(() => $("adminToast").classList.remove("show"), 2200);
}

function confirmAction(message, title = "Sahkan tindakan", confirmLabel = "Teruskan") {
  return new Promise(resolve => {
    const dialog = $("confirmDialog");
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    $("confirmProceed").textContent = confirmLabel;
    const onCancel = event => {
      event.preventDefault();
      finish(false);
    };
    const finish = result => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      $("confirmCancel").onclick = null;
      $("confirmProceed").onclick = null;
      resolve(result);
    };
    $("confirmCancel").onclick = () => finish(false);
    $("confirmProceed").onclick = () => finish(true);
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();
    $("confirmCancel").focus();
  });
}

const adminStatusLabels = {
  AVAILABLE: "Ready Stock",
  INCOMING: "Akan Tiba",
  "PORT KLANG": "Di Pelabuhan",
  "DONE PAID DUTI": "Sedia Diproses",
  BOOKED: "Ditempah",
  RESERVED: "Ditempah",
  SOLD: "Terjual",
  HIDDEN: "Disembunyikan"
};
const adminStatusLabel = value => adminStatusLabels[String(value || "").toUpperCase()] || String(value || "Tidak diketahui");
const adminStatusClass = value => `status-${String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "stock";
}

function normalizeChassis(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function looksLikeChassis(value) {
  const normalized = normalizeChassis(value);
  return normalized.length >= 5 && /[A-Z]/.test(normalized) && /\d/.test(normalized);
}

function chassisFor(car = {}) {
  const direct = normalizeChassis(car.chassis_no);
  if (direct) return direct;
  return looksLikeChassis(car.marketing_label) ? normalizeChassis(car.marketing_label) : "";
}

function chassisGroups() {
  const groups = new Map();
  inventoryRows.forEach(car => {
    const key = chassisFor(car);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(car);
  });
  return groups;
}

function duplicateChassisGroups() {
  return [...chassisGroups().entries()].filter(([, group]) => group.length > 1);
}

function duplicateChassisKeys() {
  return new Set(duplicateChassisGroups().map(([key]) => key));
}

function uniqueUrls(urls) {
  return [...new Set((urls || []).map(url => String(url || "").trim()).filter(Boolean))];
}

function publicUrlToStoragePath(url) {
  const marker = "/storage/v1/object/public/branding/";
  const value = String(url || "");
  if (!value.includes(marker)) return "";
  const path = value.split(marker)[1] || "";
  return decodeURIComponent(path.split("?")[0]);
}

function buildBrandingPublicUrl(path) {
  return db.storage.from("branding").getPublicUrl(path).data.publicUrl;
}

function getCarGallery(car = {}) {
  return uniqueUrls([
    car.image_url || "",
    ...(Array.isArray(car.gallery_urls) ? car.gallery_urls : [])
  ]);
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
  const [inventoryData, settingsData, salesmenData, eventsData, deliveriesData, leadsData] = await Promise.all([
    readQuery("Inventory", db.from("inventory").select("*").order("updated_at", { ascending: false }), []),
    readQuery("Settings", db.from("site_settings").select("*").eq("id", 1).maybeSingle(), {}),
    readQuery("Salesmen", db.from("salesmen").select("*").order("name"), []),
    readQuery("Events", db.from("site_events").select("*").order("start_date", { ascending: false }), []),
    readQuery("Deliveries", db.from("deliveries").select("*").order("sort_order", { ascending: true }).order("delivered_at", { ascending: false }), []),
    readQuery("Leads", db.from("lead_events").select("*").order("created_at", { ascending: false }).limit(200), [])
  ]);
  inventoryRows = inventoryData;
  settingsRow = settingsData || {};
  salesmanRows = salesmenData;
  eventRows = eventsData;
  deliveryRows = deliveriesData;
  leadRows = leadsData;
  renderDashboard();
  renderInventory();
  renderSettings();
  renderSalesmen();
  renderEvents();
  renderDeliveries();
  renderLeads();
  if (schemaWarnings.length) toast("Ada schema baru belum aktif. Run supabase-schema.sql jika perlu.");
}

function renderDashboard() {
  const activeCars = inventoryRows.filter(x => x.is_active);
  $("statUnits").textContent = activeCars.reduce((sum, x) => sum + Number(x.units || 1), 0);
  $("statModels").textContent = activeCars.length;
  $("statIncoming").textContent = activeCars.filter(x => x.status === "INCOMING").reduce((sum, x) => sum + Number(x.units || 1), 0);
  $("statDelivered").textContent = deliveryRows.filter(x => x.is_active).length;
  $("statLeads").textContent = leadRows.length;
  $("statSalesmen").textContent = salesmanRows.filter(x => x.is_active).length;

  const statuses = Object.entries(activeCars.reduce((acc, car) => {
    acc[car.status || "UNKNOWN"] = (acc[car.status || "UNKNOWN"] || 0) + Number(car.units || 1);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  $("overviewBreakdown").innerHTML = statuses.map(([name, count]) => `<div><span>${safeText(adminStatusLabel(name))}</span><b>${count} unit</b></div>`).join("") || "<p>Belum ada inventory.</p>";

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

  const staleCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const noPhotos = activeCars.filter(car => getCarGallery(car).length === 0).length;
  const incomplete = activeCars.filter(car => !car.price || !car.location || !car.brand || !car.model).length;
  const stale = activeCars.filter(car => {
    const timestamp = Date.parse(car.updated_at || car.created_at || "");
    return timestamp && timestamp < staleCutoff;
  }).length;
  const duplicates = duplicateIdsToRemove().length;
  const today = new Date().toDateString();
  const interactionsToday = leadRows.filter(lead => new Date(lead.created_at).toDateString() === today).length;
  const healthItems = [
    [noPhotos, "Stok tanpa gambar", "Tambah visual supaya listing lebih meyakinkan.", "inventory", noPhotos ? "warning" : "good"],
    [incomplete, "Maklumat belum lengkap", "Harga, lokasi, brand atau model masih kosong.", "inventory", incomplete ? "warning" : "good"],
    [stale, "Tidak dikemas kini 30+ hari", "Semak availability dan status unit lama.", "inventory", stale ? "warning" : "good"],
    [duplicates, "Duplicate chassis", "Review nombor chassis berulang sebelum cleanup.", "inventory", duplicates ? "danger" : "good"],
    [interactionsToday, "Interactions hari ini", "Klik berniat tinggi daripada website.", "leads", "info"],
    [liveEvent ? 1 : 0, "Campaign live", liveEvent ? liveEvent.title : "Tiada campaign aktif.", "events", liveEvent ? "good" : "info"]
  ];
  $("adminHealth").innerHTML = healthItems.map(([count, label, hint, page, tone]) => `
    <button type="button" class="health-item ${tone}" data-go-page="${page}">
      <strong>${safeText(count)}</strong><span>${safeText(label)}</span><small>${safeText(hint)}</small>
    </button>`).join("");
}

function filteredInventory() {
  const search = $("adminStockSearch").value.trim().toLowerCase();
  const status = $("adminStockStatus").value;
  const chassisFilter = $("adminChassisFilter")?.value || "all";
  const duplicateKeys = duplicateChassisKeys();
  return inventoryRows.filter(car =>
    (status === "all" || car.status === status) &&
    (chassisFilter === "all" ||
      (chassisFilter === "duplicate" && duplicateKeys.has(chassisFor(car))) ||
      (chassisFilter === "missing" && !chassisFor(car)) ||
      (chassisFilter === "complete" && Boolean(chassisFor(car)))) &&
    (!search || [car.brand, car.model, car.variant, car.grade, car.year, car.location, chassisFor(car)].join(" ").toLowerCase().includes(search))
  );
}

function duplicateGroups() {
  return duplicateChassisGroups().map(([, group]) => group);
}

function duplicateIdsToRemove() {
  return duplicateGroups().flatMap(group => {
    const sorted = [...group].sort((a, b) => {
      const dateDiff = (Date.parse(b.updated_at || b.created_at || "") || 0) - (Date.parse(a.updated_at || a.created_at || "") || 0);
      return dateDiff || Number(b.id || 0) - Number(a.id || 0);
    });
    return sorted.slice(1).map(item => item.id);
  }).filter(Boolean);
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseMoney(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function parseInteger(value) {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : null;
}

function parseBoolean(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["1", "yes", "true", "y", "featured", "hot", "active", "available"].includes(text);
}

function parseDelimitedRows(text) {
  const delimiter = text.includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function pickValue(row, headerMap, aliases) {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (index !== undefined) return row[index] || "";
  }
  return "";
}

function inferBrandAndModel(rawBrand, rawModel) {
  const knownBrands = ["Toyota", "Lexus", "Honda", "Nissan", "Mazda", "Mercedes", "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Porsche", "Subaru", "Mitsubishi", "Suzuki"];
  let brand = String(rawBrand || "").trim();
  let model = String(rawModel || "").trim();
  if (!brand && model) {
    const found = knownBrands.find(item => model.toLowerCase().startsWith(item.toLowerCase() + " "));
    if (found) {
      brand = found === "Mercedes" ? "Mercedes-Benz" : found;
      model = model.slice(found.length).trim();
    }
  }
  return { brand, model };
}

function inventoryImportKey(car) {
  const chassis = chassisFor(car);
  if (chassis) return `chassis|${chassis.toLowerCase()}`;
  return [
    car.brand,
    car.model,
    car.year || "",
    car.grade || "",
    car.variant || "",
    car.marketing_label || ""
  ].map(value => String(value || "").trim().toLowerCase()).join("|");
}

function normalizePricelistRow(row, headerMap, lineNumber) {
  const rawBrand = pickValue(row, headerMap, ["brand", "make", "maker", "jenama"]);
  const rawModel = pickValue(row, headerMap, ["model", "modelname", "carmodel", "car", "vehicle", "vehiclename", "name", "nama", "unit"]);
  const { brand, model } = inferBrandAndModel(rawBrand, rawModel);
  const price = parseMoney(pickValue(row, headerMap, ["price", "pricerm", "harga", "hargarm", "sellingprice", "sellingpricerm", "otr", "otrrm", "otrprice", "adminprice"]));
  if (!brand || !model) return { error: `Line ${lineNumber}: brand/model tak cukup` };
  return {
    brand,
    model,
    year: parseInteger(pickValue(row, headerMap, ["year", "tahun", "manufactureyear", "makeyear"])),
    grade: pickValue(row, headerMap, ["grade", "gred", "spec", "specification"]),
    variant: pickValue(row, headerMap, ["variant", "varian", "trim"]),
    type: pickValue(row, headerMap, ["type", "bodytype", "category", "kategori"]) || "Other",
    price,
    mileage: parseInteger(pickValue(row, headerMap, ["mileage", "km", "kilometer", "mileagekm", "mileageinkm"])),
    status: (pickValue(row, headerMap, ["status", "availability"]) || "AVAILABLE").toUpperCase(),
    location: pickValue(row, headerMap, ["location", "lokasi", "branch", "yard"]) || "HQ Taman Wahyu",
    units: parseInteger(pickValue(row, headerMap, ["units", "unit", "qty", "quantity"])) || 1,
    campaign_tag: pickValue(row, headerMap, ["campaign", "campaigntag", "event", "promo"]),
    marketing_label: pickValue(row, headerMap, ["label", "marketinglabel", "tag"]),
    chassis_no: normalizeChassis(pickValue(row, headerMap, ["chassis", "chassisno", "chassisnumber", "vin", "stockno", "stocknumber"])),
    engine: pickValue(row, headerMap, ["engine", "cc"]),
    transmission: pickValue(row, headerMap, ["transmission", "gearbox"]),
    exterior_color: pickValue(row, headerMap, ["color", "colour", "exterior", "exteriorcolor", "warna"]),
    image_url: pickValue(row, headerMap, ["image", "imageurl", "photo", "photourl"]),
    is_featured: parseBoolean(pickValue(row, headerMap, ["featured", "homepagefeatured"])),
    is_hot: parseBoolean(pickValue(row, headerMap, ["hot", "hotpick"])),
    is_active: true,
    updated_at: new Date().toISOString()
  };
}

function parsePricelistText(text) {
  const rows = parseDelimitedRows(text);
  if (rows.length < 2) return { records: [], errors: ["File kosong atau header tidak dijumpai."] };
  const headers = rows[0].map(normalizeHeader);
  const headerMap = new Map(headers.map((header, index) => [header, index]));
  const records = [];
  const errors = [];
  rows.slice(1).forEach((row, index) => {
    const normalized = normalizePricelistRow(row, headerMap, index + 2);
    if (normalized.error) errors.push(normalized.error);
    else records.push(normalized);
  });
  const deduped = [...new Map(records.map(record => [inventoryImportKey(record), record])).values()];
  return { records: deduped, errors };
}

async function extractPdfLines(file) {
  const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const groups = new Map();
    content.items.forEach(item => {
      const text = String(item.str || "").trim();
      if (!text) return;
      const y = Math.round(item.transform?.[5] || 0);
      const x = Math.round(item.transform?.[4] || 0);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push({ x, text });
    });
    [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => {
        const line = items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim();
        if (line) lines.push(line);
      });
  }
  return lines;
}

function parsePdfPricelistLines(lines) {
  const modelRules = [
    [/LAND CRUISER PRADO/i, "Toyota", "Land Cruiser Prado", "SUV"],
    [/LAND CRUISER 250/i, "Toyota", "Land Cruiser 250", "SUV"],
    [/\b250 (?:VX|ZX)/i, "Toyota", "Land Cruiser 250", "SUV"],
    [/\bVELLFIRE\b/i, "Toyota", "Vellfire", "MPV"],
    [/\bALPHARD\b/i, "Toyota", "Alphard", "MPV"],
    [/\bSTEPWAGON\b/i, "Honda", "Stepwgn", "MPV"],
    [/\bHARRIER\b/i, "Toyota", "Harrier", "SUV"],
    [/\bRX300\b/i, "Lexus", "RX300", "SUV"],
    [/\bNOAH\b/i, "Toyota", "Noah", "MPV"],
    [/\bVOXY\b/i, "Toyota", "Voxy", "MPV"],
    [/\bCLA180\b/i, "Mercedes-Benz", "CLA180", "Sedan"],
    [/\bB180\b/i, "Mercedes-Benz", "B180", "Hatchback"],
    [/\bA180\b/i, "Mercedes-Benz", "A180", "Sedan"],
    [/\bA250\b/i, "Mercedes-Benz", "A250", "Sedan"],
    [/\b(?:AMG )?GLA35\b/i, "Mercedes-Benz", "GLA35 AMG", "SUV"],
    [/\bCOPEN\b/i, "Daihatsu", "Copen", "Sports"],
    [/\bTAFT\b/i, "Daihatsu", "Taft", "SUV"],
    [/\bCROWN\b/i, "Toyota", "Crown", "Sedan"],
    [/\bTYPE R\b/i, "Honda", "Civic Type R", "Sports"],
    [/\bCIVIC HATCHBACK\b/i, "Honda", "Civic Hatchback", "Hatchback"],
    [/\bFL1 EX\b/i, "Honda", "Civic FL1", "Sedan"],
    [/\bN ?BOX\b/i, "Honda", "N-Box", "Mini MPV"],
    [/\bGR 86\b/i, "Toyota", "GR86", "Sports"]
  ];
  const records = [];
  const errors = [];
  const blocks = [];
  let current = null;
  let skipIncoming = false;
  const recent = [];

  lines.forEach((line, index) => {
    const clean = String(line || "").replace(/\s+/g, " ").trim();
    if (!clean) return;
    if (/^INCOMING STOCK$/i.test(clean)) {
      skipIncoming = true;
      current = null;
      return;
    }
    if (/PRICELIST WMSB/i.test(clean)) {
      skipIncoming = false;
      current = null;
      return;
    }
    if (skipIncoming) return;

    const start = clean.match(/^(\d+)\s+(WG6|WU6|WV6)(?:\s+\(([^)]+)\))?\s+(.+)$/i);
    if (start) {
      current = {
        lineNumber: index + 1,
        stockNumber: start[1],
        yard: start[2].toUpperCase(),
        anchor: clean,
        prefix: recent.slice(-2),
        tail: []
      };
      blocks.push(current);
    } else if (current && !/PRICELIST IASB|SELLING PRICE|NO BONDED LOT/i.test(clean)) {
      current.tail.push(clean);
    }
    recent.push(clean);
    if (recent.length > 3) recent.shift();
  });

  blocks.forEach(block => {
    const combined = [block.anchor, ...block.tail.slice(0, 5)].join(" ");
    const modelSource = [...block.prefix, block.anchor].join(" ");
    const rule = modelRules.find(([pattern]) => pattern.test(modelSource));
    if (!rule) {
      errors.push(`PDF line ${block.lineNumber}: model tak dapat detect`);
      return;
    }
    const [pattern, brand, model, type] = rule;
    const modelMatch = block.anchor.match(pattern);
    const modelStart = modelMatch?.index ?? -1;
    let variant = modelStart >= 0 ? block.anchor.slice(modelStart + (modelMatch?.[0]?.length || 0))
      .split(/\s+\((?:3BA|5BA|6BA|8BA|3DA|4BA|5AA|DBA)-/i)[0]
      .replace(/\b(?:AVAILABLE|SOLD|BOOKED|INCOMING)\b.*$/i, "")
      .replace(/^\s*[-–|]+|\s+/g, " ")
      .trim() : "";
    if (variant.length > 70) variant = variant.slice(0, 70).trim();

    const yearMatch = block.anchor.match(/\b(20[0-3]\d|19[8-9]\d)\b/);
    const priceMatch = combined.match(/RM\s*([\d,]+(?:\.\d{1,2})?)/i);
    const mileageMatch = combined.match(/(?:MILEAGE\s*)?(\d{1,3}(?:,\d{3})+|\d{1,3})\s*(K|KM)\b/i);
    const statusSource = [...block.prefix, block.anchor].join(" ");
    const status = /SOLD/i.test(block.anchor) ? "SOLD"
      : /BOOKED/i.test(block.anchor) ? "BOOKED"
      : /DONE\s+PAID(?:\s+DUTI)?/i.test(statusSource) ? "DONE PAID DUTI"
      : /PORT\s+KLANG/i.test(statusSource) ? "PORT KLANG"
      : "AVAILABLE";
    const chassisPattern = /\b(?:AGH|TAHA|MZRA|RP3|MXUA|AGL|FK7|FL5|FL1|W1K|W1N|LA|GDJ|TRJ|ZRR|JF3)[A-Z0-9-]*\s*\d{4,7}\b/i;
    const chassisMatch = combined.match(chassisPattern);
    const reference = chassisMatch
      ? chassisMatch[0].replace(/\s+/g, "").toUpperCase()
      : `${block.yard}-${block.stockNumber}`;
    const location = block.yard === "WG6" ? "Gombak"
      : block.yard === "WV6" ? "Wanmo"
      : "HQ Taman Wahyu";

    records.push({
      brand,
      model,
      year: yearMatch ? Number(yearMatch[1]) : null,
      grade: "",
      variant,
      type,
      price: priceMatch ? parseMoney(priceMatch[1]) : 0,
      mileage: mileageMatch ? parseInteger(mileageMatch[1]) * (mileageMatch[2].toUpperCase() === "K" ? 1000 : 1) : null,
      status,
      location,
      units: 1,
      chassis_no: normalizeChassis(reference),
      marketing_label: "",
      is_active: true,
      updated_at: new Date().toISOString()
    });
  });
  const deduped = [...new Map(records.map(record => [inventoryImportKey(record), record])).values()];
  if (!deduped.length) errors.push("PDF dibaca, tapi stock row tak dapat dikesan. Cuba export sebagai CSV untuk hasil lebih tepat.");
  return { records: deduped, errors };
}

async function parsePricelistFile(file) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const lines = await extractPdfLines(file);
    return parsePdfPricelistLines(lines);
  }
  const text = await file.text();
  return parsePricelistText(text);
}

function pricelistImportPlan(records = parsedPricelistRows) {
  const existingMap = new Map(inventoryRows.map(car => [inventoryImportKey(car), car]));
  const insertRows = [];
  const updateRows = [];
  records.forEach(record => {
    const match = existingMap.get(inventoryImportKey(record));
    if (match) updateRows.push({ id: match.id, record });
    else insertRows.push(record);
  });
  return { insertRows, updateRows };
}

function renderPricelistPreview(errors = []) {
  const { insertRows, updateRows } = pricelistImportPlan();
  const sample = parsedPricelistRows.slice(0, 4).map(row => `
    <tr><td>${safeText(row.brand)} ${safeText(row.model)}</td><td>${safeText(chassisFor(row) || "-")}</td><td>${safeText([row.year, row.grade, row.variant].filter(Boolean).join(" · ") || "-")}</td><td>${money(row.price)}</td><td>${safeText(row.status)}</td></tr>
  `).join("");
  $("importPricelistButton").disabled = !parsedPricelistRows.length;
  $("pricelistPreview").innerHTML = parsedPricelistRows.length ? `
    <div class="import-stats">
      <article><span>Valid rows</span><strong>${parsedPricelistRows.length}</strong></article>
      <article><span>Will update</span><strong>${updateRows.length}</strong></article>
      <article><span>Will insert</span><strong>${insertRows.length}</strong></article>
      <article><span>Skipped</span><strong>${errors.length}</strong></article>
    </div>
    <table><thead><tr><th>Model</th><th>Chassis</th><th>Spec</th><th>Price</th><th>Status</th></tr></thead><tbody>${sample}</tbody></table>
    ${errors.length ? `<small>${safeText(errors.slice(0, 3).join(" | "))}${errors.length > 3 ? " ..." : ""}</small>` : ""}
  ` : `Tiada row valid dijumpai. Pastikan file ada header Brand, Model dan Price.`;
}

function renderInventoryQuickStats(visibleRows = filteredInventory()) {
  const active = visibleRows.filter(car => car.is_active);
  const featured = active.filter(car => car.is_featured).length;
  const withPhotos = active.filter(car => getCarGallery(car).length > 0).length;
  const hidden = visibleRows.filter(car => !car.is_active).length;
  const withChassis = visibleRows.filter(car => chassisFor(car)).length;
  const totalUnits = active.reduce((sum, car) => sum + Number(car.units || 1), 0);
  $("inventoryQuickStats").innerHTML = [
    ["Visible stock", `${active.length}`, `${totalUnits} unit live`],
    ["Featured", `${featured}`, "Homepage picks"],
    ["With photos", `${withPhotos}`, "Gallery attached"],
    ["Chassis ready", `${withChassis}`, `${Math.max(0, visibleRows.length - withChassis)} missing`],
    ["Hidden", `${hidden}`, "Draft / hidden"]
  ].map(([label, value, hint]) => `
    <article>
      <span>${safeText(label)}</span>
      <strong>${safeText(value)}</strong>
      <small>${safeText(hint)}</small>
    </article>
  `).join("");
}

function renderChassisHealth() {
  const duplicateGroups = duplicateChassisGroups();
  const duplicateRows = duplicateGroups.reduce((sum, [, group]) => sum + group.length, 0);
  const missing = inventoryRows.filter(car => !chassisFor(car)).length;
  const unique = chassisGroups().size;
  $("chassisHealthSummary").textContent = duplicateRows
    ? `${duplicateGroups.length} duplicate chassis group · ${duplicateRows} rows untuk review`
    : `${unique} unique chassis · ${missing} belum diisi · tiada duplicate`;
  $("showDuplicateChassis").disabled = duplicateRows === 0;
  $("selectDuplicateChassis").disabled = duplicateRows === 0;
  $("removeDuplicateInventory").disabled = duplicateRows === 0;
  $("showMissingChassis").disabled = missing === 0;
}

function renderCarPhotoPreview(car = {}) {
  const gallery = getCarGallery(car);
  $("carPhotoPreview").innerHTML = gallery.length ? gallery.slice(0, 6).map((url, index) => `
    <article class="photo-preview-card ${index === 0 ? "main" : ""}">
      <img src="${safeText(url)}" alt="Stock photo ${index + 1}">
      <span>${index === 0 ? "Main image" : `Gallery ${index}`}</span>
    </article>
  `).join("") : `<div class="photo-preview-empty">Belum ada gambar. Simpan stok dulu, kemudian buka photo manager untuk upload banyak gambar sekali.</div>`;
  $("openCarPhotoManager").disabled = !car.id;
}

function syncInventoryBulkToolbar(visibleRows = filteredInventory()) {
  const visibleIds = visibleRows.map(car => String(car.id));
  const selectedVisibleCount = visibleIds.filter(id => selectedInventoryIds.has(id)).length;
  const selectedTotal = selectedInventoryIds.size;
  const duplicateCount = duplicateIdsToRemove().length;
  $("selectedInventoryCount").textContent = `${selectedTotal} selected`;
  $("duplicateInventoryHint").textContent = duplicateCount
    ? `${duplicateCount} duplicate chassis row${duplicateCount > 1 ? "s" : ""} boleh dibuang`
    : "No chassis duplicates detected";
  $("deleteSelectedInventory").disabled = selectedTotal === 0;
  $("removeDuplicateInventory").disabled = duplicateCount === 0;
  $("clearInventorySelection").disabled = selectedTotal === 0;
  $("bulkOpenPhotoManager").disabled = selectedTotal !== 1;
  $("bulkPhotoManagerButton").disabled = selectedTotal !== 1;
  $("selectAllInventory").checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  $("selectAllInventory").indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  $("inventoryBulkToolbar").classList.toggle("has-selection", selectedTotal > 0);
}

function labelAdminTables() {
  document.querySelectorAll(".table-wrap table").forEach(table => {
    const labels = [...table.querySelectorAll("thead th")].map(header => header.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(row => {
      [...row.children].forEach((cell, index) => cell.setAttribute("data-label", labels[index] || ""));
    });
  });
}

function renderInventory() {
  const visibleRows = filteredInventory();
  $("inventoryTable").innerHTML = visibleRows.map(car => `
    <tr>
      <td class="select-col"><input class="inventory-row-check" type="checkbox" data-select-car="${car.id}" ${selectedInventoryIds.has(String(car.id)) ? "checked" : ""} aria-label="Select ${safeText(car.brand)} ${safeText(car.model)}"></td>
      <td class="table-main">
        <b>${safeText(car.brand)} ${safeText(car.model)} ${car.is_featured ? '<span class="mini-badge">FEATURED</span>' : ""}${car.campaign_tag ? `<span class="mini-badge">${safeText(car.campaign_tag)}</span>` : ""}${car.is_hot ? '<span class="mini-badge">HOT</span>' : ""}</b>
        <small>${safeText([car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "-")}</small>
      </td>
      <td>${safeText(car.location)}</td>
      <td><span class="status-chip ${adminStatusClass(car.is_active ? car.status : "HIDDEN")}"><i aria-hidden="true"></i>${safeText(adminStatusLabel(car.is_active ? car.status : "HIDDEN"))}</span></td>
      <td>${money(car.price)}</td>
      <td>${km(car.mileage)}</td>
      <td>${Number(car.units || 1)}</td>
      <td><div class="row-actions"><button data-edit-car="${car.id}">Edit</button><button class="danger" data-delete-car="${car.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="8">Tiada stok dijumpai.</td></tr>`;
  syncInventoryBulkToolbar(visibleRows);
  labelAdminTables();
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
  labelAdminTables();
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
  labelAdminTables();
}

function renderDeliveries() {
  $("deliveriesTable").innerHTML = deliveryRows.map(item => `
    <tr>
      <td class="table-main"><b>${safeText(item.title)}</b><small>${formatDate(item.delivered_at)} · ${safeText(item.customer_name || "-")}</small></td>
      <td>${safeText(item.model)}</td>
      <td>${safeText(item.location)}</td>
      <td><span class="status-chip">${item.is_active ? "ACTIVE" : "INACTIVE"}</span></td>
      <td><div class="row-actions"><button data-edit-delivery="${item.id}">Edit</button><button class="danger" data-delete-delivery="${item.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="5">Belum ada delivery. Tambah gambar serahan customer untuk homepage.</td></tr>`;
  labelAdminTables();
}

function renderLeads() {
  const byAction = leadRows.reduce((acc, lead) => {
    acc[lead.action || "unknown"] = (acc[lead.action || "unknown"] || 0) + 1;
    return acc;
  }, {});
  $("leadSummary").innerHTML = Object.entries(byAction).slice(0, 6).map(([action, count]) => `
    <article><span>${safeText(action)}</span><strong>${count}</strong></article>
  `).join("") || `<p class="admin-help">Belum ada lead click. Deploy lead tracker dahulu atau tunggu traffic masuk.</p>`;

  $("leadsTable").innerHTML = leadRows.map(lead => `
    <tr>
      <td>${formatLeadTime(lead.created_at)}</td>
      <td>${safeText(lead.page)}</td>
      <td><span class="status-chip">${safeText(lead.action)}</span></td>
      <td class="table-main"><b>${safeText(lead.label || lead.car_name || "-")}</b><small>${safeText(lead.car_name || lead.source_url || "-")}</small></td>
      <td>${lead.source_url ? `<a href="${safeText(lead.source_url)}" target="_blank" rel="noopener">Open</a>` : ""}</td>
    </tr>`).join("") || `<tr><td colspan="5">Belum ada lead.</td></tr>`;
  labelAdminTables();
}

function formatLeadTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-MY", { dateStyle: "short", timeStyle: "short" });
}

function updateCarChassisHint(currentId = $("carId")?.value) {
  const value = normalizeChassis($("carChassisNo")?.value);
  const matches = value
    ? inventoryRows.filter(car => chassisFor(car) === value && String(car.id) !== String(currentId || ""))
    : [];
  const hint = $("carChassisHint");
  if (!hint) return matches;
  hint.classList.toggle("duplicate", matches.length > 0);
  hint.textContent = matches.length
    ? `Duplicate: chassis ini sudah digunakan oleh ${matches.map(car => `${car.brand} ${car.model} (#${car.id})`).join(", ")}.`
    : value ? "Chassis unique. Format akan disimpan dalam huruf besar tanpa ruang." : "Digunakan untuk detect duplicate dan carian stok.";
  return matches;
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
  $("carChassisNo").value = chassisFor(car);
  $("carCampaignTag").value = car.campaign_tag || "";
  $("carMarketingLabel").value = car.marketing_label || "";
  $("carEngine").value = car.engine || "";
  $("carTransmission").value = car.transmission || "";
  $("carExteriorColor").value = car.exterior_color || "";
  $("carInteriorColor").value = car.interior_color || "";
  $("carDescription").value = car.description || "";
  $("carGalleryUrls").value = Array.isArray(car.gallery_urls) ? car.gallery_urls.join("\n") : "";
  $("carImageUrl").value = car.image_url || "";
  $("carActive").checked = car.is_active ?? true;
  $("carFeatured").checked = Boolean(car.is_featured);
  $("carHot").checked = Boolean(car.is_hot);
  $("carAuctionReport").checked = Boolean(car.auction_report);
  $("carMileageVerified").checked = Boolean(car.mileage_verified);
  $("carGradeVerified").checked = Boolean(car.grade_verified);
  updateCarChassisHint(car.id);
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
  $("eventCampaignTag").value = event.campaign_tag || event.title || "";
  $("eventCtaLabel").value = event.cta_label || "WhatsApp untuk info lanjut";
  $("eventCtaMessage").value = event.cta_message || "";
  $("eventBannerUrl").value = event.banner_url || "";
  $("eventBannerFile").value = "";
  $("eventActive").checked = event.is_active ?? true;
  $("eventDialog").showModal();
}

function openDeliveryDialog(item = {}) {
  $("deliveryDialogTitle").textContent = item.id ? "Edit delivery" : "Tambah delivery";
  $("deliveryId").value = item.id || "";
  $("deliveryTitle").value = item.title || "";
  $("deliveryCustomer").value = item.customer_name || "";
  $("deliveryModel").value = item.model || "";
  $("deliveryLocation").value = item.location || "";
  $("deliveryDate").value = item.delivered_at || "";
  $("deliverySort").value = item.sort_order || 0;
  $("deliveryCaption").value = item.caption || "";
  $("deliveryPhotoUrl").value = item.photo_url || "";
  $("deliveryPhotoFile").value = "";
  $("deliveryActive").checked = item.is_active ?? true;
  $("deliveryDialog").showModal();
}

function updateCarGalleryFields(urls) {
  const list = uniqueUrls(urls);
  $("carImageUrl").value = list[0] || "";
  $("carGalleryUrls").value = list.slice(1).join("\n");
}

function findCarById(id) {
  return inventoryRows.find(car => Number(car.id) === Number(id));
}

async function saveCarMediaState(carId, urls) {
  const gallery = uniqueUrls(urls);
  const payload = {
    image_url: gallery[0] || "",
    gallery_urls: gallery.slice(1),
    updated_at: new Date().toISOString()
  };
  const { error } = await db.from("inventory").update(payload).eq("id", carId);
  if (error) throw error;
  return payload;
}

async function uploadFilesForCar(car, files) {
  const slug = `${slugify(car.brand)}-${slugify(car.model)}-${car.id || Date.now()}`;
  const uploaded = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `stock/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await db.storage.from("branding").upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    uploaded.push(buildBrandingPublicUrl(path));
  }
  return uploaded;
}

function renderPhotoManager(carId = photoManagerCarId) {
  const car = findCarById(carId);
  if (!car) {
    $("photoManagerTitle").textContent = "Photo manager";
    $("photoManagerSummary").innerHTML = "";
    $("photoManagerGrid").innerHTML = `<div class="photo-preview-empty">Pilih satu stock dahulu untuk manage gambar.</div>`;
    return;
  }
  const gallery = getCarGallery(car);
  $("photoManagerCarId").value = String(car.id);
  $("photoManagerTitle").textContent = `${car.brand} ${car.model} photo manager`;
  $("photoManagerSummary").innerHTML = `
    <article><span>Main image</span><strong>${gallery[0] ? "Ready" : "Missing"}</strong></article>
    <article><span>Total photos</span><strong>${gallery.length}</strong></article>
    <article><span>Stock</span><strong>${safeText(car.status || "AVAILABLE")}</strong></article>
  `;
  $("photoManagerGrid").innerHTML = gallery.length ? gallery.map((url, index) => `
    <article class="photo-manager-card ${index === 0 ? "main" : ""}">
      <div class="photo-frame">
        <img src="${safeText(url)}" alt="${safeText(`${car.brand} ${car.model}, gambar ${index + 1}`)}" loading="lazy">
        <span class="photo-position-badge">${index + 1}</span>
        ${index === 0 ? '<span class="photo-main-badge">Cover</span>' : ""}
      </div>
      <div class="photo-card-content">
        <div class="photo-manager-meta">
          <b>${index === 0 ? "Main image" : `Gallery image ${index + 1}`}</b>
          <small title="${safeText(url.split("/").pop()?.split("?")[0] || "photo")}">${safeText(url.split("/").pop()?.split("?")[0] || "photo")}</small>
        </div>
        <div class="photo-manager-actions">
          <button type="button" data-photo-main="${index}" ${index === 0 ? "disabled" : ""} title="Jadikan gambar utama">Cover</button>
          <button type="button" data-photo-left="${index}" ${index === 0 ? "disabled" : ""} title="Alih ke kiri" aria-label="Alih gambar ${index + 1} ke kiri">←</button>
          <button type="button" data-photo-right="${index}" ${index === gallery.length - 1 ? "disabled" : ""} title="Alih ke kanan" aria-label="Alih gambar ${index + 1} ke kanan">→</button>
          <button type="button" class="danger" data-photo-remove="${index}" title="Buang gambar">Delete</button>
        </div>
      </div>
    </article>
  `).join("") : `<div class="photo-preview-empty">Belum ada gambar untuk stock ini. Upload beberapa gambar untuk mula bina gallery.</div>`;
}

function updatePhotoManagerSelection() {
  const files = [...$("photoManagerFiles").files];
  $("photoManagerFileLabel").textContent = files.length
    ? `${files.length} gambar dipilih`
    : "Pilih gambar untuk ditambah";
  $("photoManagerUploadButton").disabled = !files.length;
}

async function openPhotoManager(carId) {
  const car = findCarById(carId);
  if (!car) return toast("Stock tak dijumpai");
  photoManagerCarId = Number(carId);
  renderPhotoManager(photoManagerCarId);
  $("photoManagerFiles").value = "";
  updatePhotoManagerSelection();
  $("photoManagerDialog").showModal();
}

renderInventory = function renderInventoryEnhanced() {
  const visibleRows = filteredInventory();
  const duplicateKeys = duplicateChassisKeys();
  renderInventoryQuickStats(visibleRows);
  renderChassisHealth();
  $("inventoryTable").innerHTML = visibleRows.map(car => `
    <tr>
      <td class="select-col"><input class="inventory-row-check" type="checkbox" data-select-car="${car.id}" ${selectedInventoryIds.has(String(car.id)) ? "checked" : ""} aria-label="Select ${safeText(car.brand)} ${safeText(car.model)}"></td>
      <td class="table-main">
        <b>${safeText(car.brand)} ${safeText(car.model)} ${car.is_featured ? '<span class="mini-badge">FEATURED</span>' : ""}${car.campaign_tag ? `<span class="mini-badge">${safeText(car.campaign_tag)}</span>` : ""}${car.is_hot ? '<span class="mini-badge">HOT</span>' : ""}</b>
        <small>${safeText([car.year, car.grade, car.variant].filter(Boolean).join(" · ") || "-")}</small>
        <small>${getCarGallery(car).length ? `${getCarGallery(car).length} photos attached` : "No photos yet"}</small>
      </td>
      <td class="chassis-cell ${duplicateKeys.has(chassisFor(car)) ? "is-duplicate" : ""}">
        <code>${safeText(chassisFor(car) || "NOT SET")}</code>
        ${duplicateKeys.has(chassisFor(car)) ? '<span class="mini-badge chassis-alert">DUPLICATE</span>' : `<small>${chassisFor(car) ? "Unique chassis" : "Add chassis in Edit"}</small>`}
        ${chassisFor(car) ? `<button type="button" class="chassis-copy" data-copy-chassis="${safeText(chassisFor(car))}">Copy</button>` : ""}
      </td>
      <td>${safeText(car.location)}</td>
      <td><span class="status-chip ${adminStatusClass(car.is_active ? car.status : "HIDDEN")}"><i aria-hidden="true"></i>${safeText(adminStatusLabel(car.is_active ? car.status : "HIDDEN"))}</span></td>
      <td>${money(car.price)}</td>
      <td>${km(car.mileage)}</td>
      <td>${Number(car.units || 1)}</td>
      <td><div class="row-actions"><button data-edit-car="${car.id}">Edit</button><button data-photos-car="${car.id}">Photos</button><button class="danger" data-delete-car="${car.id}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="9">Tiada stok dijumpai.</td></tr>`;
  syncInventoryBulkToolbar(visibleRows);
  labelAdminTables();
};

openCarDialog = function openCarDialogEnhanced(car = {}) {
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
  $("carChassisNo").value = chassisFor(car);
  $("carCampaignTag").value = car.campaign_tag || "";
  $("carMarketingLabel").value = car.marketing_label || "";
  $("carEngine").value = car.engine || "";
  $("carTransmission").value = car.transmission || "";
  $("carExteriorColor").value = car.exterior_color || "";
  $("carInteriorColor").value = car.interior_color || "";
  $("carDescription").value = car.description || "";
  $("carGalleryUrls").value = Array.isArray(car.gallery_urls) ? car.gallery_urls.join("\n") : "";
  $("carImageUrl").value = car.image_url || "";
  $("carActive").checked = car.is_active ?? true;
  $("carFeatured").checked = Boolean(car.is_featured);
  $("carHot").checked = Boolean(car.is_hot);
  $("carAuctionReport").checked = Boolean(car.auction_report);
  $("carMileageVerified").checked = Boolean(car.mileage_verified);
  $("carGradeVerified").checked = Boolean(car.grade_verified);
  renderCarPhotoPreview(car);
  updateCarChassisHint(car.id);
  $("carDialog").showModal();
};

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

function openAdminPage(page) {
  const activeButton = document.querySelector(`.admin-nav[data-page="${page}"]`);
  document.querySelectorAll(".admin-nav").forEach(button => button.classList.toggle("active", button === activeButton));
  document.querySelectorAll(".admin-page").forEach(panel => panel.classList.toggle("active", panel.dataset.pagePanel === page));
  $("pageTitle").textContent = activeButton?.textContent.trim() || "Overview";
  document.querySelector(".admin-sidebar").classList.remove("open");
  $("mobileMenu").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".admin-nav").forEach(button => button.addEventListener("click", () => openAdminPage(button.dataset.page)));
$("adminHealth").addEventListener("click", event => {
  const target = event.target.closest("[data-go-page]");
  if (target) openAdminPage(target.dataset.goPage);
});

$("mobileMenu").addEventListener("click", () => {
  const sidebar = document.querySelector(".admin-sidebar");
  const open = sidebar.classList.toggle("open");
  $("mobileMenu").setAttribute("aria-expanded", String(open));
});
$("showPricelistImporter").addEventListener("click", () => {
  $("pricelistImporter").hidden = false;
  $("pricelistFile").focus();
});
$("closePricelistImporter").addEventListener("click", () => {
  $("pricelistImporter").hidden = true;
  $("showPricelistImporter").focus();
});
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => {
  $(button.dataset.closeDialog).close();
}));
document.querySelectorAll(".close-dialog").forEach(button => button.setAttribute("aria-label", "Tutup dialog"));
$("adminStockSearch").addEventListener("input", renderInventory);
$("adminStockStatus").addEventListener("change", renderInventory);
$("adminChassisFilter").addEventListener("change", renderInventory);
$("showDuplicateChassis").addEventListener("click", () => {
  $("adminChassisFilter").value = "duplicate";
  renderInventory();
});
$("showMissingChassis").addEventListener("click", () => {
  $("adminChassisFilter").value = "missing";
  renderInventory();
});
$("resetChassisFilter").addEventListener("click", () => {
  $("adminChassisFilter").value = "all";
  renderInventory();
});
$("selectDuplicateChassis").addEventListener("click", () => {
  selectedInventoryIds.clear();
  duplicateChassisGroups().forEach(([, group]) => group.forEach(car => selectedInventoryIds.add(String(car.id))));
  $("adminChassisFilter").value = "duplicate";
  renderInventory();
  toast(`${selectedInventoryIds.size} duplicate chassis rows dipilih untuk review`);
});
$("carChassisNo").addEventListener("input", () => updateCarChassisHint());
$("carChassisNo").addEventListener("blur", event => {
  event.target.value = normalizeChassis(event.target.value);
  updateCarChassisHint();
});
$("addCarButton").addEventListener("click", () => openCarDialog());
$("carImageUrl").addEventListener("input", () => renderCarPhotoPreview({
  id: $("carId").value,
  image_url: $("carImageUrl").value,
  gallery_urls: $("carGalleryUrls").value.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
}));
$("carGalleryUrls").addEventListener("input", () => renderCarPhotoPreview({
  id: $("carId").value,
  image_url: $("carImageUrl").value,
  gallery_urls: $("carGalleryUrls").value.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
}));
$("openCarPhotoManager").addEventListener("click", () => {
  const carId = Number($("carId").value);
  if (!carId) return toast("Simpan stok dahulu sebelum urus gambar");
  openPhotoManager(carId);
});
$("bulkPhotoManagerButton").addEventListener("click", () => {
  const ids = [...selectedInventoryIds].map(Number).filter(Boolean);
  if (ids.length !== 1) return toast("Pilih satu stok dahulu untuk bulk upload gambar");
  openPhotoManager(ids[0]);
});
$("bulkOpenPhotoManager").addEventListener("click", () => {
  const ids = [...selectedInventoryIds].map(Number).filter(Boolean);
  if (ids.length !== 1) return toast("Pilih satu stok dahulu untuk manage gambar");
  openPhotoManager(ids[0]);
});
$("addSalesmanButton").addEventListener("click", () => openSalesmanDialog());
$("addEventButton").addEventListener("click", () => openEventDialog({ title: "E-Carnival Stock Clearance", kicker: "SPECIAL EVENT", cta_label: "WhatsApp untuk info lanjut" }));
$("addDeliveryButton").addEventListener("click", () => openDeliveryDialog({ title: "Delivered by Izuwan", location: "HQ Taman Wahyu" }));
$("refreshLeadsButton").addEventListener("click", loadAll);
$("importStarterButton").addEventListener("click", async () => {
  if (inventoryRows.length && !await confirmAction("Inventory sudah mempunyai rekod. Import stok asal boleh menghasilkan duplicate.", "Import stok asal?", "Import juga")) return;
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

$("previewPricelistButton").addEventListener("click", async () => {
  const file = $("pricelistFile").files[0];
  if (!file) return toast("Pilih file CSV atau PDF dahulu");
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    return toast("Upload CSV atau PDF. Untuk Excel, export sebagai CSV dahulu.");
  }
  $("previewPricelistButton").disabled = true;
  $("previewPricelistButton").textContent = "Reading...";
  try {
    const { records, errors } = await parsePricelistFile(file);
    const excludeIncoming = $("excludeIncomingPricelist")?.checked;
    const incomingCount = records.filter(record => String(record.status || "").toUpperCase() === "INCOMING").length;
    parsedPricelistRows = excludeIncoming
      ? records.filter(record => String(record.status || "").toUpperCase() !== "INCOMING")
      : records;
    const importNotes = incomingCount && excludeIncoming ? [...errors, `${incomingCount} incoming row dikecualikan`] : errors;
    renderPricelistPreview(importNotes);
    toast(`${parsedPricelistRows.length} row pricelist sedia untuk import`);
  } catch (error) {
    parsedPricelistRows = [];
    renderPricelistPreview([error.message]);
    toast("PDF/CSV gagal dibaca");
  } finally {
    $("previewPricelistButton").disabled = false;
    $("previewPricelistButton").textContent = "Preview";
  }
});

$("pricelistFile").addEventListener("change", () => {
  parsedPricelistRows = [];
  $("importPricelistButton").disabled = true;
  $("pricelistPreview").textContent = $("pricelistFile").files[0]?.name || "Belum ada file dipilih.";
});

$("importPricelistButton").addEventListener("click", async () => {
  if (!parsedPricelistRows.length) return toast("Preview pricelist dahulu");
  const mode = $("pricelistMode").value;
  const { insertRows, updateRows } = pricelistImportPlan();
  const rowsToInsert = mode === "update" ? [] : insertRows;
  const rowsToUpdate = mode === "insert" ? [] : updateRows;
  if (!rowsToInsert.length && !rowsToUpdate.length) return toast("Tiada stok untuk diimport mengikut mode ini");
  if (!await confirmAction(`Sistem akan update ${rowsToUpdate.length} rekod dan memasukkan ${rowsToInsert.length} rekod baru.`, "Import pricelist sekarang?", "Import pricelist")) return;

  $("importPricelistButton").disabled = true;
  $("importPricelistButton").textContent = "Importing...";

  if (rowsToInsert.length) {
    const { error } = await db.from("inventory").insert(rowsToInsert);
    if (error) {
      $("importPricelistButton").disabled = false;
      $("importPricelistButton").textContent = "Import / Update";
      return toast(error.message);
    }
  }

  for (const item of rowsToUpdate) {
    const { error } = await db.from("inventory").update(item.record).eq("id", item.id);
    if (error) {
      $("importPricelistButton").disabled = false;
      $("importPricelistButton").textContent = "Import / Update";
      return toast(error.message);
    }
  }

  const pricelistDate = $("pricelistDate").value.trim();
  if (pricelistDate) {
    await db.from("site_settings").upsert({ id: 1, pricelist_date: pricelistDate, updated_at: new Date().toISOString() });
  }

  parsedPricelistRows = [];
  $("pricelistFile").value = "";
  $("importPricelistButton").textContent = "Import / Update";
  $("pricelistPreview").innerHTML = `Import complete. Updated ${rowsToUpdate.length}, inserted ${rowsToInsert.length}.`;
  toast(`Pricelist updated: ${rowsToUpdate.length} update, ${rowsToInsert.length} insert`);
  await loadAll();
});

$("inventoryTable").addEventListener("click", async event => {
  const selectId = event.target.dataset.selectCar;
  const editId = event.target.dataset.editCar;
  const photosId = event.target.dataset.photosCar;
  const deleteId = event.target.dataset.deleteCar;
  const copyChassis = event.target.dataset.copyChassis;
  if (copyChassis) {
    await navigator.clipboard.writeText(copyChassis);
    toast(`${copyChassis} copied`);
    return;
  }
  if (selectId) {
    if (event.target.checked) selectedInventoryIds.add(String(selectId));
    else selectedInventoryIds.delete(String(selectId));
    syncInventoryBulkToolbar();
    return;
  }
  if (editId) openCarDialog(inventoryRows.find(x => x.id === Number(editId)));
  if (photosId) return openPhotoManager(Number(photosId));
  if (deleteId && await confirmAction("Stok ini akan dipadam secara kekal dan tidak boleh dipulihkan.", "Padam stok?", "Padam stok")) {
    const { error } = await db.from("inventory").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Stok dipadam");
    await loadAll();
  }
});

$("selectAllInventory").addEventListener("change", event => {
  filteredInventory().forEach(car => {
    if (event.target.checked) selectedInventoryIds.add(String(car.id));
    else selectedInventoryIds.delete(String(car.id));
  });
  renderInventory();
});

$("selectVisibleInventory").addEventListener("click", () => {
  filteredInventory().forEach(car => selectedInventoryIds.add(String(car.id)));
  renderInventory();
});

$("clearInventorySelection").addEventListener("click", () => {
  selectedInventoryIds.clear();
  renderInventory();
});

$("photoManagerUploadButton").addEventListener("click", async () => {
  const carId = Number($("photoManagerCarId").value || photoManagerCarId);
  const car = findCarById(carId);
  const files = [...$("photoManagerFiles").files];
  if (!car) return toast("Stock tak dijumpai");
  if (!files.length) return toast("Pilih gambar dahulu");
  $("photoManagerUploadButton").disabled = true;
  $("photoManagerUploadButton").textContent = "Uploading...";
  try {
    const uploaded = await uploadFilesForCar(car, files);
    const nextGallery = uniqueUrls([...getCarGallery(car), ...uploaded]);
    await saveCarMediaState(car.id, nextGallery);
    toast(`${uploaded.length} gambar dimuat naik`);
    await loadAll();
    renderPhotoManager(car.id);
    renderCarPhotoPreview(findCarById(car.id) || car);
    $("photoManagerFiles").value = "";
    updatePhotoManagerSelection();
  } catch (error) {
    toast(error.message || "Upload gambar gagal");
  } finally {
    $("photoManagerUploadButton").textContent = "Upload gambar";
    updatePhotoManagerSelection();
  }
});

$("photoManagerFiles").addEventListener("change", updatePhotoManagerSelection);

$("photoManagerGrid").addEventListener("click", async event => {
  const carId = Number($("photoManagerCarId").value || photoManagerCarId);
  const car = findCarById(carId);
  if (!car) return;
  const mainIndex = event.target.dataset.photoMain;
  const leftIndex = event.target.dataset.photoLeft;
  const rightIndex = event.target.dataset.photoRight;
  const removeIndex = event.target.dataset.photoRemove;
  let gallery = [...getCarGallery(car)];

  if (mainIndex !== undefined) {
    const index = Number(mainIndex);
    gallery = [gallery[index], ...gallery.filter((_, i) => i !== index)];
  }
  if (leftIndex !== undefined) {
    const index = Number(leftIndex);
    [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]];
  }
  if (rightIndex !== undefined) {
    const index = Number(rightIndex);
    [gallery[index], gallery[index + 1]] = [gallery[index + 1], gallery[index]];
  }
  if (removeIndex !== undefined) {
    const index = Number(removeIndex);
    const removedUrl = gallery[index];
    gallery.splice(index, 1);
    const storagePath = publicUrlToStoragePath(removedUrl);
    if (storagePath) await db.storage.from("branding").remove([storagePath]);
  }

  try {
    await saveCarMediaState(car.id, gallery);
    await loadAll();
    renderPhotoManager(car.id);
    renderCarPhotoPreview(findCarById(car.id) || car);
    toast("Gallery updated");
  } catch (error) {
    toast(error.message || "Gallery update gagal");
  }
});

async function updateSelectedInventory(payload, successLabel) {
  const ids = [...selectedInventoryIds].map(Number).filter(Boolean);
  if (!ids.length) return toast("Pilih stok dahulu");
  const { error } = await db.from("inventory").update({ ...payload, updated_at: new Date().toISOString() }).in("id", ids);
  if (error) return toast(error.message);
  toast(`${ids.length} stok ${successLabel}`);
  await loadAll();
}

$("applyBulkStatus").addEventListener("click", () => {
  const status = $("bulkStatusSelect").value;
  if (!status) return toast("Pilih status dahulu");
  updateSelectedInventory({ status }, `ditukar ke ${status}`);
});

$("applyBulkCampaign").addEventListener("click", () => {
  const campaign = $("bulkCampaignInput").value.trim();
  if (!campaign) return toast("Isi campaign tag dahulu");
  updateSelectedInventory({ campaign_tag: campaign }, "dimasukkan ke campaign");
});

$("bulkFeaturedOn").addEventListener("click", () => updateSelectedInventory({ is_featured: true }, "featured"));
$("bulkFeaturedOff").addEventListener("click", () => updateSelectedInventory({ is_featured: false }, "unfeatured"));

$("deleteSelectedInventory").addEventListener("click", async () => {
  const ids = [...selectedInventoryIds].map(Number).filter(Boolean);
  if (!ids.length) return toast("Pilih stok dahulu");
  if (!await confirmAction(`${ids.length} stok terpilih akan dipadam secara kekal. Tindakan ini tidak boleh dibatalkan.`, "Padam stok terpilih?", `Padam ${ids.length} stok`)) return;
  const { error } = await db.from("inventory").delete().in("id", ids);
  if (error) return toast(error.message);
  selectedInventoryIds.clear();
  toast(`${ids.length} stok dipadam`);
  await loadAll();
});

$("removeDuplicateInventory").addEventListener("click", async () => {
  const ids = duplicateIdsToRemove();
  if (!ids.length) return toast("Tiada duplicate chassis dikesan");
  if (!await confirmAction(`${ids.length} duplicate chassis akan dipadam. Sistem akan menyimpan satu rekod terbaru bagi setiap nombor chassis.`, "Bersihkan duplicate chassis?", `Padam ${ids.length} duplicate`)) return;
  const { error } = await db.from("inventory").delete().in("id", ids);
  if (error) return toast(error.message);
  ids.forEach(id => selectedInventoryIds.delete(String(id)));
  toast(`${ids.length} duplicate chassis dipadam`);
  await loadAll();
});

$("eventsTable").addEventListener("click", async event => {
  const editId = event.target.dataset.editEvent;
  const deleteId = event.target.dataset.deleteEvent;
  if (editId) openEventDialog(eventRows.find(x => x.id === Number(editId)));
  if (deleteId && await confirmAction("Event ini akan dipadam dan banner berkaitan tidak lagi muncul di website.", "Padam event?", "Padam event")) {
    const { error } = await db.from("site_events").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Event dipadam");
    await loadAll();
  }
});

$("deliveriesTable").addEventListener("click", async event => {
  const editId = event.target.dataset.editDelivery;
  const deleteId = event.target.dataset.deleteDelivery;
  if (editId) openDeliveryDialog(deliveryRows.find(x => x.id === Number(editId)));
  if (deleteId && await confirmAction("Rekod delivery ini akan dipadam daripada homepage secara kekal.", "Padam delivery?", "Padam delivery")) {
    const { error } = await db.from("deliveries").delete().eq("id", deleteId);
    if (error) return toast(error.message);
    toast("Delivery dipadam");
    await loadAll();
  }
});

$("carForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("carId").value;
  const chassisNo = normalizeChassis($("carChassisNo").value);
  const chassisMatches = updateCarChassisHint(id);
  if (chassisMatches.length) {
    toast(`Duplicate chassis: ${chassisNo} sudah digunakan oleh stok #${chassisMatches[0].id}`);
    $("carChassisNo").focus();
    return;
  }
  const sellingPrice = Number($("carAdminPrice").value);
  if (sellingPrice > 0 && sellingPrice < 10000) {
    toast("Selling price nampak tidak lengkap. Semak semula jumlah penuh dalam RM.");
    $("carAdminPrice").focus();
    return;
  }
  const manualGallery = uniqueUrls([
    $("carImageUrl").value.trim(),
    ...$("carGalleryUrls").value.split(/\r?\n/).map(url => url.trim()).filter(Boolean)
  ]);
  const payload = {
    brand: $("carBrand").value.trim(),
    model: $("carModel").value.trim(),
    year: $("carYear").value ? Number($("carYear").value) : null,
    grade: $("carGrade").value.trim(),
    variant: $("carVariant").value.trim(),
    type: $("carType").value,
    price: sellingPrice,
    mileage: $("carMileage").value ? Number($("carMileage").value) : null,
    status: $("carStatus").value,
    location: $("carLocation").value.trim(),
    units: Number($("carUnits").value) || 1,
    chassis_no: chassisNo || null,
    campaign_tag: $("carCampaignTag").value.trim(),
    marketing_label: $("carMarketingLabel").value.trim(),
    engine: $("carEngine").value.trim(),
    transmission: $("carTransmission").value.trim(),
    exterior_color: $("carExteriorColor").value.trim(),
    interior_color: $("carInteriorColor").value.trim(),
    description: $("carDescription").value.trim(),
    gallery_urls: manualGallery.slice(1),
    image_url: manualGallery[0] || "",
    is_featured: $("carFeatured").checked,
    is_hot: $("carHot").checked,
    auction_report: $("carAuctionReport").checked,
    mileage_verified: $("carMileageVerified").checked,
    grade_verified: $("carGradeVerified").checked,
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
    campaign_tag: $("eventCampaignTag").value.trim(),
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

$("deliveryForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("deliveryId").value;
  let photoUrl = $("deliveryPhotoUrl").value.trim();
  const file = $("deliveryPhotoFile").files[0];
  if (file) {
    const extension = file.name.split(".").pop();
    const path = `deliveries/delivery-${Date.now()}.${extension}`;
    const { error: uploadError } = await db.storage.from("branding").upload(path, file, { upsert: true });
    if (uploadError) return toast(uploadError.message);
    photoUrl = db.storage.from("branding").getPublicUrl(path).data.publicUrl;
  }
  const payload = {
    title: $("deliveryTitle").value.trim(),
    customer_name: $("deliveryCustomer").value.trim(),
    model: $("deliveryModel").value.trim(),
    location: $("deliveryLocation").value.trim(),
    delivered_at: $("deliveryDate").value || null,
    caption: $("deliveryCaption").value.trim(),
    photo_url: photoUrl,
    sort_order: Number($("deliverySort").value) || 0,
    is_active: $("deliveryActive").checked,
    updated_at: new Date().toISOString()
  };
  const query = id ? db.from("deliveries").update(payload).eq("id", id) : db.from("deliveries").insert(payload);
  const { error } = await query;
  if (error) return toast(error.message);
  $("deliveryDialog").close();
  toast(id ? "Delivery dikemas kini" : "Delivery ditambah");
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
  if (deleteId && await confirmAction("Profil salesman ini akan dipadam. Pertimbangkan untuk nyahaktifkan jika rekod masih diperlukan.", "Padam salesman?", "Padam salesman")) {
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
