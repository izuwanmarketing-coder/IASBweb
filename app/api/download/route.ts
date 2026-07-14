import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { browserCookieArgs, downloaderBinary, friendlyError, validateMediaUrl } from "../_lib/downloader";
import { getTelegramMessage } from "../_lib/telegram";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const run = promisify(execFile);

function safeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 160);
}

function telegramExtension(mimeType?: string) {
  return mimeType === "video/mp4" ? ".mp4"
    : mimeType === "image/jpeg" ? ".jpg"
    : mimeType === "image/png" ? ".png"
    : mimeType === "image/webp" ? ".webp"
    : mimeType === "audio/mpeg" ? ".mp3"
    : ".bin";
}

export async function POST(request: Request) {
  let directory = "";
  try {
    const body = await request.json();
    const url = validateMediaUrl(body.url);
    if (new URL(url).hostname.replace(/^www\./, "") === "t.me" || new URL(url).hostname === "telegram.me") {
      try {
        const { client, message, messages } = await getTelegramMessage(url);
        if (messages.length > 1) {
          const zip = new JSZip();
          for (let index = 0; index < messages.length; index += 1) {
            const item = messages[index];
            const result = await client.downloadMedia(item, {});
            if (!Buffer.isBuffer(result)) continue;
            const extension = telegramExtension(item.file?.mimeType);
            const filename = safeFilename(item.file?.name || `${String(index + 1).padStart(2, "0")}-telegram-${item.id}${extension}`);
            zip.file(filename, result);
          }
          const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
          return new Response(archive as unknown as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="telegram-album-${message.id}.zip"`, "Cache-Control": "no-store" } });
        }
        const result = await client.downloadMedia(message, {});
        if (!Buffer.isBuffer(result)) throw new Error("Telegram did not return a downloadable file.");
        const file = message.file;
        const extension = telegramExtension(file?.mimeType);
        const filename = safeFilename(file?.name || `telegram-${message.id}${extension}`);
        return new Response(result as unknown as BodyInit, { headers: { "Content-Type": file?.mimeType || "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "Telegram download failed." }, { status: 422 });
      }
    }
    const mode = body.mode === "audio" ? "audio" : "video";
    const quality = ["best", "1080", "720", "480"].includes(body.quality) ? body.quality : "best";
    directory = await mkdtemp(path.join(os.tmpdir(), "droply-"));
    const output = path.join(directory, "%(title).120B [%(id)s].%(ext)s");
    const args = ["--no-playlist", "--no-warnings", "--restrict-filenames", ...browserCookieArgs(body.browser), "-o", output];
    if (mode === "audio") args.push("-f", "ba/b");
    else {
      const format = quality === "best"
        ? "b"
        : `b[height<=${quality}]/b`;
      args.push("-f", format);
    }
    args.push(url);
    const binary = await downloaderBinary();
    try {
      await run(binary, args, { timeout: 180_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    } catch (error) {
      const failure = error as { stderr?: string; message?: string };
      return Response.json({ error: friendlyError(`${failure.message || ""}\n${failure.stderr || ""}`) }, { status: 422 });
    }
    const files = (await readdir(directory)).filter((name) => !name.endsWith(".part") && !name.endsWith(".ytdl"));
    if (!files.length) return Response.json({ error: "The download finished without a usable file." }, { status: 422 });
    const filename = files[0];
    const file = await readFile(path.join(directory, filename));
    const extension = path.extname(filename).toLowerCase();
    const type = extension === ".mp3" ? "audio/mpeg"
      : extension === ".m4a" ? "audio/mp4"
      : extension === ".mp4" ? "video/mp4"
      : extension === ".webm" ? (mode === "audio" ? "audio/webm" : "video/webm")
      : "application/octet-stream";
    return new Response(file, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Download failed." }, { status: 400 });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
