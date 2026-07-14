const DEFAULT_SHEET_ID = "1InuhPGVy7jkjX2cuRZwDK3QbShzU4FJd";
const DEFAULT_SHEET_NAME = "MAIN IASB ";

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
  // purchase rate and internal notes never leave the server-side function.
  return rows.slice(headerIndex).map(row => {
    const safeRow = Array(43).fill("");
    for (let index = 15; index <= 29; index++) safeRow[index] = row[index] || "";
    safeRow[42] = row[42] || "";
    return safeRow.map(csvCell).join(",");
  }).join("\r\n");
}

export async function onRequestGet({ env }) {
  const sheetId = env.INVENTORY_SHEET_ID || DEFAULT_SHEET_ID;
  const sheetName = env.INVENTORY_SHEET_NAME || DEFAULT_SHEET_NAME;
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(sourceUrl, {
    headers: { Accept: "text/csv" },
    cf: { cacheEverything: true, cacheTtl: 300 }
  });
  if (!response.ok) {
    return Response.json({ error: "Inventory source unavailable" }, { status: 502 });
  }

  try {
    const csv = safeInventoryCsv(await response.text());
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Google Sheet inventory parse failed", error);
    return Response.json({ error: "Inventory format unavailable" }, { status: 502 });
  }
}
