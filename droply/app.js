const API = "https://droply-api.izuwanautomobile.com";
const form = document.querySelector("#mediaForm");
const input = document.querySelector("#mediaUrl");
const button = document.querySelector("#getButton");
const result = document.querySelector("#result");

document.querySelector("#pasteButton").addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    input.focus();
  } catch {
    showError("Clipboard access is blocked. Paste with Ctrl + V.");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = "Checking...";
  result.innerHTML = "";

  try {
    const response = await fetch(`${API}/api/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.value, browser: "none" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read this link.");

    const count = data.itemCount > 1 ? ` / ${data.itemCount} files / downloads as ZIP` : "";
    result.innerHTML = `<div class="notice success"><strong>${escapeHtml(data.title)}</strong><p>${escapeHtml(data.uploader)} / ${escapeHtml(data.platform)}${count}</p><button id="downloadButton">Download now</button></div>`;
    document.querySelector("#downloadButton").addEventListener("click", () => downloadMedia());
  } catch (error) {
    showError(error.message || "Droply engine is offline.");
  } finally {
    button.disabled = false;
    button.textContent = "Get media";
  }
});

async function downloadMedia() {
  const downloadButton = document.querySelector("#downloadButton");
  downloadButton.disabled = true;
  downloadButton.textContent = "Saving...";

  try {
    const response = await fetch(`${API}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.value, mode: "video", quality: "best", browser: "none" }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Download failed.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "droply-download";
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    downloadButton.textContent = "Saved!";
    setTimeout(() => {
      downloadButton.disabled = false;
      downloadButton.textContent = "Download now";
    }, 2200);
  } catch (error) {
    showError(error.message || "Download failed.");
  }
}

function showError(message) {
  result.innerHTML = `<div class="notice error"><strong>Could not get that link</strong><p>${escapeHtml(message)}</p></div>`;
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value || "");
  return node.innerHTML;
}
