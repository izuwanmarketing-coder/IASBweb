import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { browserCookieArgs, downloaderBinary, friendlyError, validateMediaUrl } from "../_lib/downloader";
import { getTelegramMessage } from "../_lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const run = promisify(execFile);

export async function POST(request: Request) {
  try {
    const { url: rawUrl, browser } = await request.json();
    const url = validateMediaUrl(rawUrl);
    if (new URL(url).hostname.replace(/^www\./, "") === "t.me" || new URL(url).hostname === "telegram.me") {
      try {
        const { message, messages } = await getTelegramMessage(url);
        return Response.json({
          title: messages.length > 1 ? `Telegram album · ${messages.length} files` : String(message.message || "Telegram media").slice(0, 240),
          thumbnail: null,
          uploader: "Private Telegram channel",
          duration: null,
          platform: "Telegram",
          kind: "video",
          itemCount: messages.length
        });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Could not read Telegram post." }, { status: 422 });
      }
    }
    const binary = await downloaderBinary();
    let stdout = "";
    try {
      const result = await run(binary, ["--dump-single-json", "--no-playlist", "--no-warnings", ...browserCookieArgs(browser), url], { timeout: 45_000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
      stdout = result.stdout;
    } catch (error) {
      const failure = error as { stderr?: string; message?: string };
      return Response.json({ error: friendlyError(`${failure.message || ""}\n${failure.stderr || ""}`) }, { status: 422 });
    }
    const data = JSON.parse(stdout);
    return Response.json({
      title: String(data.title || data.description || "Untitled post").slice(0, 240),
      thumbnail: data.thumbnail || data.thumbnails?.at(-1)?.url || null,
      uploader: data.uploader || data.channel || data.creator || "Public post",
      duration: typeof data.duration === "number" ? data.duration : null,
      platform: data.extractor_key || data.extractor || new URL(url).hostname,
      kind: data.vcodec === "none" && data.acodec === "none" ? "image" : "video"
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }
}
