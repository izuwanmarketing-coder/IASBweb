import { access } from "node:fs/promises";
import path from "node:path";

const allowedHosts = [
  "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "instagram.com", "facebook.com", "fb.watch", "threads.net",
  "telegram.me", "t.me", "youtube.com", "youtu.be", "x.com", "twitter.com"
];

export function validateMediaUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Paste a valid post link.");
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("That does not look like a valid link."); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Only web links are supported.");
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!allowedHosts.some((item) => host === item || host.endsWith(`.${item}`))) {
    throw new Error("This site is not supported yet. Try TikTok, Instagram, Facebook or Telegram.");
  }
  return parsed.toString();
}

export async function downloaderBinary() {
  const local = path.join(process.cwd(), "tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  try { await access(local); return local; } catch { return "yt-dlp"; }
}

export function browserCookieArgs(value: unknown) {
  const browser = typeof value === "string" ? value.toLowerCase() : "none";
  return ["chrome", "edge", "firefox", "brave"].includes(browser)
    ? ["--cookies-from-browser", browser]
    : [];
}

export function friendlyError(stderr: string) {
  const text = stderr.toLowerCase();
  if (text.includes("not recognized") || text.includes("enoent") || text.includes("not found")) return "The local download engine is not installed yet. Run the setup script once, then retry.";
  if (text.includes("could not copy") || text.includes("database is locked") || text.includes("failed to decrypt")) return "Could not read that browser session. Close the selected browser completely, reopen Droply, and try again.";
  if (text.includes("login") || text.includes("cookie") || text.includes("private")) return "This post needs a valid login. Open it in the selected browser first, then retry with Private access enabled.";
  if (text.includes("unsupported url")) return "This exact post type is not supported by the download engine.";
  return "The platform refused this link or the post is unavailable. Check that it is public and try again.";
}
