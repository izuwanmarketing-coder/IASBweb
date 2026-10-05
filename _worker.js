const DEFAULT_SHEET_ID = "1InuhPGVy7jkjX2cuRZwDK3QbShzU4FJd";
const DEFAULT_SHEET_NAME = "MAIN IASB ";

function parsePricelistDate(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {
    timestamp,
    label: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`
  };
}

function latestPricelistDate(source) {
  const labels = [...String(source || "").matchAll(/docs-sheet-tab-caption[^>]*>\s*([^<]+?)\s*</g)]
    .map(match => parsePricelistDate(match[1]))
    .filter(Boolean)
    .sort((left, right) => right.timestamp - left.timestamp);
  return labels[0]?.label || "";
}

async function getSheetPricelistDate(sheetId) {
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit?usp=sharing`;
  const response = await fetch(sourceUrl, {
    headers: { Accept: "text/html" },
    cf: { cacheEverything: true, cacheTtl: 300 }
  });
  if (!response.ok) throw new Error(`Google Sheet metadata request failed (${response.status})`);
  return latestPricelistDate(await response.text());
}

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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeInventoryCsv(source) {
  const rows = parseCsv(source);
  const headerIndex = rows.findIndex(row => {
    const values = row.map(value => String(value || "").trim().toUpperCase());
    return values.includes("MODEL") && values.includes("CHASSIS NO") && values.includes("STATUS");
  });
  if (headerIndex < 0) throw new Error("Inventory header not found");

  // Keep operational inventory P:AD plus public grade AQ. Cost, duty, profit,
  // purchase rate and internal notes never leave the server-side worker.
  return rows.slice(headerIndex).map(row => {
    const safeRow = Array(43).fill("");
    for (let index = 15; index <= 29; index++) safeRow[index] = row[index] || "";
    safeRow[42] = row[42] || "";
    return safeRow.map(csvCell).join(",");
  }).join("\r\n");
}

// Explicit cutover contract: a separate sheet containing ONLY these public fields.
// Keep the 43-column browser format so existing data-service consumers still work.
const PUBLIC_FIELDS = [
  ["NO", 15], ["BONDED", 16], ["STOCK NO", 17], ["LOT NO", 18],
  ["Y", 19], ["M", 20], ["D", 21], ["MODEL", 22], ["CHASSIS NO", 23],
  ["S", 24], ["COLOUR", 25], ["MILEAGE", 26], ["SPECS", 27],
  ["STATUS", 28], ["SELLING PRICE", 29], ["GRADE", 42]
];
const publicHeaderKey = value => String(value).trim().toUpperCase().replace(/[ _]+/g, " ");

function parsePublicCsv(source) {
  const text = String(source).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", state = "start";
  function pushCell() { row.push(cell); cell = ""; state = "start"; }
  function pushRow() { pushCell(); if (row.some(value => value.trim())) rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else state = "closed";
      } else cell += char;
    } else if (char === ',') pushCell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (char === '"' && state === "start") state = "quoted";
    else {
      if (state === "closed" || char === '"') throw new Error("Malformed public CSV");
      cell += char; state = "plain";
    }
  }
  if (state === "quoted") throw new Error("Unclosed public CSV quote");
  if (cell || row.length || state !== "start") pushRow();
  return rows;
}

function publicInventoryCsv(source, configuredDate) {
  const rows = parsePublicCsv(source);
  if (!rows.length) throw new Error("Missing public headers");
  const headers = rows[0].map(publicHeaderKey);
  const required = PUBLIC_FIELDS.map(([name]) => name);
  if (new Set(headers).size !== headers.length || headers.some(name => !required.includes(name) && name !== "PRICELIST DATE") || required.some(name => !headers.includes(name))) throw new Error("Unexpected public inventory schema");
  let date = configuredDate ? parsePricelistDate(configuredDate) : null;
  if (configuredDate && !date) throw new Error("Invalid public pricelist date");
  const outputHeader = Array(43).fill("");
  PUBLIC_FIELDS.forEach(([name, index]) => outputHeader[index] = name);
  const output = [outputHeader];
  for (const row of rows.slice(1)) {
    if (row.length !== headers.length) throw new Error("Unexpected public row width");
    const dateIndex = headers.indexOf("PRICELIST DATE");
    if (dateIndex >= 0 && row[dateIndex].trim()) {
      const parsed = parsePricelistDate(row[dateIndex]);
      if (!parsed) throw new Error("Invalid public pricelist date");
      if (!date || parsed.timestamp > date.timestamp) date = parsed;
    }
    const safeRow = Array(43).fill("");
    PUBLIC_FIELDS.forEach(([name, index]) => safeRow[index] = row[headers.indexOf(name)]);
    output.push(safeRow);
  }
  return { csv: output.map(row => row.map(csvCell).join(",")).join("\r\n"), date: date?.label || "" };
}

async function publicInventoryResponse(env) {
  // Once configured, ANY failure is closed. Never consult the original source.
  try {
    const id = String(env.INVENTORY_PUBLIC_SHEET_ID || "").trim();
    if (!/^[A-Za-z0-9_-]{10,120}$/.test(id) || id === DEFAULT_SHEET_ID || id === String(env.INVENTORY_SHEET_ID || "").trim()) throw new Error("Invalid replacement source");
    const query = new URLSearchParams({ tqx: "out:csv" });
    if (env.INVENTORY_PUBLIC_SHEET_NAME) query.set("sheet", env.INVENTORY_PUBLIC_SHEET_NAME);
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?${query}`, { headers: { Accept: "text/csv" }, cf: { cacheEverything: true, cacheTtl: 300 } });
    if (!response.ok) throw new Error("Public source unavailable");
    const result = publicInventoryCsv(await response.text(), env.INVENTORY_PUBLIC_PRICELIST_DATE);
    const headers = { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff" };
    if (result.date) headers["X-Inventory-Pricelist-Date"] = result.date;
    return new Response(result.csv, { headers });
  } catch {
    return Response.json({ error: "Public inventory unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

async function inventoryResponse(env) {
  if (env.INVENTORY_PUBLIC_SHEET_ID !== undefined) return publicInventoryResponse(env);
  const sheetId = env.INVENTORY_SHEET_ID || DEFAULT_SHEET_ID;
  const sheetName = env.INVENTORY_SHEET_NAME || DEFAULT_SHEET_NAME;
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const [response, pricelistDate] = await Promise.all([
    fetch(sourceUrl, {
      headers: { Accept: "text/csv" },
      cf: { cacheEverything: true, cacheTtl: 300 }
    }),
    getSheetPricelistDate(sheetId).catch(error => {
      console.error("Google Sheet pricelist date unavailable", error);
      return "";
    })
  ]);
  if (!response.ok) return Response.json({ error: "Inventory source unavailable" }, { status: 502 });

  try {
    const headers = {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff"
    };
    if (pricelistDate) headers["X-Inventory-Pricelist-Date"] = pricelistDate;
    return new Response(safeInventoryCsv(await response.text()), {
      headers
    });
  } catch (error) {
    console.error("Google Sheet inventory parse failed", error);
    return Response.json({ error: "Inventory format unavailable" }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/inventory-sheet" && request.method === "GET") {
      return inventoryResponse(env);
    }
    return env.ASSETS.fetch(request);
  }
};
