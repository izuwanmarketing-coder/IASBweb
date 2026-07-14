(function () {
  const config = window.IASB_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = configured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  const sheetUrl = config.inventorySheetEndpoint || "";
  const sheetConfigured = Boolean(sheetUrl);

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < String(text || "").length; index++) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index++;
        row.push(cell);
        if (row.some(value => String(value || "").trim())) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some(value => String(value || "").trim())) rows.push(row);
    return rows;
  }

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalizedHeader = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedChassis = value => clean(value).replace(/\s+/g, "").toUpperCase();
  const parsedNumber = value => {
    const number = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(number) ? number : null;
  };

  const vehicleRules = [
    { match: /\bALPHARD\b/i, brand: "Toyota", model: "Alphard", type: "MPV" },
    { match: /\bVELLFIRE\b/i, brand: "Toyota", model: "Vellfire", type: "MPV" },
    { match: /\bSTEPW(?:AGON|GN)\b/i, brand: "Honda", model: "Stepwgn", type: "MPV" },
    { match: /\bHARRIER\b/i, brand: "Toyota", model: "Harrier", type: "SUV" },
    { match: /\bRX ?300\b/i, brand: "Lexus", model: "RX300", type: "SUV" },
    { match: /\bNOAH\b/i, brand: "Toyota", model: "Noah", type: "MPV" },
    { match: /\bVOXY\b/i, brand: "Toyota", model: "Voxy", type: "MPV" },
    { match: /\bCLA ?180\b/i, brand: "Mercedes-Benz", model: "CLA180", type: "Sedan" },
    { match: /\bB ?180\b/i, brand: "Mercedes-Benz", model: "B180", type: "Hatchback" },
    { match: /\bA ?180\b/i, brand: "Mercedes-Benz", model: "A180", type: "Sedan" },
    { match: /\bA ?250\b/i, brand: "Mercedes-Benz", model: "A250", type: "Sedan" },
    { match: /\bGLA ?35\b/i, brand: "Mercedes-Benz", model: "GLA35 AMG", type: "SUV" },
    { match: /\bCOPEN\b/i, brand: "Daihatsu", model: "Copen", type: "Convertible" },
    { match: /\bTAFT\b/i, brand: "Daihatsu", model: "Taft", type: "SUV" },
    { match: /\bCROWN\b/i, brand: "Toyota", model: "Crown Crossover", type: "SUV" },
    { match: /\bTYPE R\b|\bFL5\b/i, brand: "Honda", model: "Civic Type R", type: "Hatchback" },
    { match: /\bCIVIC HATCHBACK\b|\bFK7\b/i, brand: "Honda", model: "Civic Hatchback", type: "Hatchback" },
    { match: /\bFL1\b/i, brand: "Honda", model: "Civic FL1", type: "Sedan" },
    { match: /\bN ?BOX\b|\bJF3\b/i, brand: "Honda", model: "N-Box", type: "Mini MPV" },
    { match: /\bGR ?86\b|\bZN8?\b/i, brand: "Toyota", model: "GR86", type: "Coupe" },
    { match: /LAND CRUISER PRADO|\bGDJ150\b/i, brand: "Toyota", model: "Land Cruiser Prado", type: "SUV" },
    { match: /LAND CRUISER 250|\b(?:TRJ|GDJ)250\b|^250 (?:VX|ZX)/i, brand: "Toyota", model: "Land Cruiser 250", type: "SUV" }
  ];

  // Powertrain rules are keyed by Japanese model/chassis codes. Sources include
  // official Toyota and Honda newsroom technical releases:
  // https://global.toyota/en/newsroom/toyota/36614730.html
  // https://global.toyota/en/newsroom/toyota/39287317.html
  // https://global.honda/en/newsroom/news/2022/4220721eng.html
  const powertrainRules = [
    [/TAHA40/i, "2.4L turbo petrol (T24A-FTS)", "8-speed automatic"],
    [/AGH30/i, "2.5L petrol (2AR-FE)", "Super CVT-i"],
    [/AGH40/i, "2.5L petrol", "CVT"],
    [/MZRA90/i, "2.0L petrol (M20A-FKS)", "Direct Shift-CVT"],
    [/ZRR80/i, "2.0L petrol (3ZR-FAE)", "Super CVT-i"],
    [/MXUA80/i, "2.0L petrol (M20A-FKS)", "Direct Shift-CVT"],
    [/AGL20/i, "2.0L turbo petrol (8AR-FTS)", "6-speed automatic"],
    [/\bRP3/i, "1.5L VTEC Turbo petrol", "CVT"],
    [/\bFL5/i, "2.0L VTEC Turbo petrol", "6-speed manual"],
    [/\bFK7/i, "1.5L VTEC Turbo petrol", "CVT"],
    [/\bFL1/i, "1.5L VTEC Turbo petrol", "CVT"],
    [/\bJF3/i, "658cc turbo petrol", "CVT"],
    [/LA400/i, "658cc turbo petrol", ""],
    [/118384|177184|177084|247084/i, "1.3L turbo petrol", "7-speed dual-clutch"],
    [/177147/i, "2.0L turbo petrol", "7-speed dual-clutch"],
    [/247751/i, "2.0L turbo petrol", "8-speed dual-clutch"],
    [/LA900/i, "658cc turbo petrol", "CVT"],
    [/GDJ150/i, "2.8L turbo diesel", "6-speed automatic"],
    [/TRJ250/i, "2.7L petrol", "6-speed automatic"],
    [/GDJ250/i, "2.8L turbo diesel", "8-speed automatic"],
    [/TZSH35/i, "2.4L turbo hybrid petrol", "6-speed automatic"],
    [/ZN8|ZN-/i, "2.4L horizontally opposed petrol", "6-speed automatic"]
  ];

  function classifyVehicle(rawModel, chassis) {
    const source = clean(`${rawModel} ${chassis}`);
    const rule = vehicleRules.find(item => item.match.test(source));
    const code = clean(rawModel).match(/\((?:3BA|4BA|5AA|5BA|6BA|8BA|DBA|3DA)-?\s*([A-Z0-9]+)\)/i)?.[1] || "";
    const withoutCodes = clean(rawModel)
      .replace(/\((?:3BA|4BA|5AA|5BA|6BA|8BA|DBA|3DA)-?\s*[A-Z0-9]+\)/ig, "")
      .replace(/^(?:TOYOTA|HONDA|LEXUS|MERCEDES(?:-BENZ)?|DAIHATSU)\s+/i, "")
      .trim();
    const variant = rule ? clean(withoutCodes.replace(rule.match, "")) : withoutCodes;
    const powertrain = powertrainRules.find(([pattern]) => pattern.test(`${code} ${chassis}`));
    return {
      brand: rule?.brand || "Other",
      model: rule?.model || withoutCodes || "Imported vehicle",
      variant,
      type: rule?.type || "Other",
      engine: powertrain?.[1] || "",
      transmission: powertrain?.[2] || ""
    };
  }

  function sheetLocation(label, current) {
    const value = clean(label).toUpperCase();
    if (/GOMBAK|WG6/.test(value)) return "Gombak";
    if (/WAHYU|WU6/.test(value)) return "HQ Taman Wahyu";
    if (/WANMO|WV6/.test(value)) return "Wanmo";
    if (/INCOMING/.test(value)) return "Incoming";
    return current;
  }

  function parseSheetInventory(text) {
    const rows = parseCsv(text);
    const headerIndex = rows.findIndex(row => {
      const headers = row.map(normalizedHeader);
      return headers.includes("model") && headers.includes("chassisno") && headers.includes("status");
    });
    if (headerIndex < 0) throw new Error("Google Sheet inventory header not found");
    const headerMap = new Map(rows[headerIndex].map((header, index) => [normalizedHeader(header), index]));
    // Google Visualization may omit labels from calculated/merged header cells.
    // These are stable positions in the MAIN IASB operational template.
    const templateColumns = {
      no: 15, bonded: 16, stockno: 17, lotno: 18, y: 19, m: 20, d: 21,
      model: 22, chassisno: 23, s: 24, colour: 25, mileage: 26, specs: 27,
      status: 28, sellingprice: 29, grade: 42
    };
    Object.entries(templateColumns).forEach(([name, index]) => {
      if (!headerMap.has(name)) headerMap.set(name, index);
    });
    const at = (row, name) => row[headerMap.get(name)] ?? "";
    const inventory = [];
    let location = "";
    for (const row of rows.slice(headerIndex + 1)) {
      const rawModel = clean(at(row, "model"));
      const chassis = normalizedChassis(at(row, "chassisno"));
      const status = clean(at(row, "status")).toUpperCase();
      if (!rawModel) {
        const sectionLabel = row.find(value => clean(value)) || "";
        location = sheetLocation(sectionLabel, location);
        continue;
      }
      if (!chassis || !status) continue;
      location = status.includes("INCOMING")
        ? "Incoming"
        : sheetLocation(at(row, "bonded"), location);
      const vehicle = classifyVehicle(rawModel, chassis);
      const year = parsedNumber(at(row, "y"));
      const mileage = parsedNumber(at(row, "mileage"));
      inventory.push({
        id: `sheet:${chassis}`,
        ...vehicle,
        year: year && year > 1980 && year < 2100 ? year : null,
        grade: clean(at(row, "grade")),
        price: parsedNumber(at(row, "sellingprice")) || 0,
        mileage: mileage && mileage > 0 ? mileage : null,
        description: clean(at(row, "specs")),
        exterior_color: clean(at(row, "colour")),
        interior_color: "",
        campaign_tag: "",
        chassis_no: chassis,
        marketing_label: clean(at(row, "stockno")),
        image_url: "",
        gallery_urls: [],
        is_featured: false,
        is_hot: false,
        auction_report: false,
        mileage_verified: false,
        grade_verified: Boolean(clean(at(row, "grade"))),
        status: status.replace(/\s+/g, " "),
        location: location || "Izuwan Automobile",
        units: 1,
        is_active: true,
        created_at: "",
        updated_at: new Date().toISOString(),
        inventory_source: "google-sheet"
      });
    }
    if (!inventory.length) throw new Error("Google Sheet contains no valid inventory rows");
    return [...new Map(inventory.map(car => [car.chassis_no, car])).values()];
  }

  function mergeSheetInventory(sheetRows, managedRows) {
    const managedByChassis = new Map((managedRows || []).map(car => [normalizedChassis(car.chassis_no), car]));
    return sheetRows.map(sheetCar => {
      const managed = managedByChassis.get(sheetCar.chassis_no);
      if (!managed) return sheetCar;
      return {
        ...managed,
        ...sheetCar,
        id: managed.id,
        engine: sheetCar.engine || managed.engine || "",
        transmission: sheetCar.transmission || managed.transmission || "",
        description: sheetCar.description || managed.description || "",
        interior_color: managed.interior_color || "",
        image_url: managed.image_url || "",
        gallery_urls: Array.isArray(managed.gallery_urls) ? managed.gallery_urls : [],
        campaign_tag: managed.campaign_tag || "",
        is_featured: Boolean(managed.is_featured),
        is_hot: Boolean(managed.is_hot),
        auction_report: Boolean(managed.auction_report),
        mileage_verified: Boolean(managed.mileage_verified),
        grade_verified: Boolean(sheetCar.grade || managed.grade_verified)
      };
    });
  }

  async function getSheetInventory(managedRows) {
    if (!sheetConfigured) return null;
    const response = await fetch(sheetUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Google Sheet request failed (${response.status})`);
    return mergeSheetInventory(parseSheetInventory(await response.text()), managedRows);
  }

  async function getInventory() {
    if (!client) return null;
    const { data, error } = await client
      .from("inventory")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: false });
    if (error) throw error;
    return data.map(row => ({
      id: row.id,
      brand: row.brand,
      model: row.model,
      year: row.year || "",
      grade: row.grade || "",
      variant: row.variant || "",
      type: row.type || "Other",
      price: Number(row.price),
      mileage: row.mileage == null ? null : Number(row.mileage),
      image_url: row.image_url || "",
      gallery_urls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
      description: row.description || "",
      engine: row.engine || "",
      transmission: row.transmission || "",
      exterior_color: row.exterior_color || "",
      interior_color: row.interior_color || "",
      campaign_tag: row.campaign_tag || "",
      chassis_no: row.chassis_no || "",
      marketing_label: row.marketing_label || "",
      is_featured: Boolean(row.is_featured),
      is_hot: Boolean(row.is_hot),
      auction_report: Boolean(row.auction_report),
      mileage_verified: Boolean(row.mileage_verified),
      grade_verified: Boolean(row.grade_verified),
      status: row.status || "AVAILABLE",
      location: row.location || "",
      units: Number(row.units) || 1,
      created_at: row.created_at || "",
      updated_at: row.updated_at || ""
    }));
  }

  async function getSettings() {
    if (!client) return null;
    const { data, error } = await client
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getEvents() {
    if (!client) return [];
    const { data, error } = await client
      .from("site_events")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: false });
    if (error) {
      console.warn("Site events unavailable.", error);
      return [];
    }
    return data || [];
  }

  async function getDeliveries() {
    if (!client) return [];
    const { data, error } = await client
      .from("deliveries")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("delivered_at", { ascending: false });
    if (error) {
      console.warn("Delivered gallery unavailable.", error);
      return [];
    }
    return data || [];
  }

  async function getSalesmen() {
    if (!client) return null;
    const { data, error } = await client
      .from("salesmen")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data;
  }

  window.IASBData = {
    client,
    configured,
    sheetConfigured,
    parseSheetInventory,
    mergeSheetInventory,
    async loadPublicData() {
      if (!client && !sheetConfigured) return { inventory: null, settings: null, salesmen: null, events: [], deliveries: [] };
      const [managedInventory, settings, salesmen, events, deliveries] = client ? await Promise.all([
        getInventory(),
        getSettings(),
        getSalesmen(),
        getEvents(),
        getDeliveries()
      ]) : [[], null, null, [], []];
      let inventory = managedInventory;
      let inventorySource = client ? "supabase" : "none";
      if (sheetConfigured) {
        try {
          inventory = await getSheetInventory(managedInventory || []);
          inventorySource = "google-sheet";
        } catch (error) {
          console.warn("Google Sheet inventory unavailable; using managed fallback.", error);
        }
      }
      return { inventory, inventorySource, settings, salesmen, events, deliveries };
    }
  };
})();
