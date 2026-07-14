"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  Facebook,
  Film,
  Image as ImageIcon,
  Instagram,
  Link2,
  LockKeyhole,
  Loader2,
  Music2,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Zap
} from "lucide-react";

type MediaInfo = {
  title: string;
  thumbnail: string | null;
  uploader: string;
  duration: number | null;
  platform: string;
  kind: "video" | "image";
  itemCount?: number;
};

const platforms = [
  { name: "TikTok", icon: Music2, color: "bg-[#72f5dc]" },
  { name: "Instagram", icon: Instagram, color: "bg-[#ff9acb]" },
  { name: "Facebook", icon: Facebook, color: "bg-[#91b5ff]" },
  { name: "Telegram", icon: Send, color: "bg-[#a9dcff]" }
];

function formatDuration(value: number | null) {
  if (!value) return "Post";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [quality, setQuality] = useState("best");
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "fetching" | "ready" | "downloading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [privateOpen, setPrivateOpen] = useState(false);
  const [browser, setBrowser] = useState("none");
  const [telegram, setTelegram] = useState({ stage: "offline", name: "", error: "" });
  const [telegramForm, setTelegramForm] = useState({ apiId: "", apiHash: "", phone: "+60", input: "" });
  const [authBusy, setAuthBusy] = useState(false);

  async function refreshTelegram() {
    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      const data = await response.json();
      setTelegram(data);
      return data;
    } catch { return null; }
  }

  useEffect(() => { void refreshTelegram(); }, []);

  useEffect(() => {
    if (!["connecting", "code", "password"].includes(telegram.stage)) return;
    const timer = window.setInterval(() => void refreshTelegram(), 1200);
    return () => window.clearInterval(timer);
  }, [telegram.stage]);

  useEffect(() => {
    if (telegram.stage !== "connecting") return;
    const timeout = window.setTimeout(() => setTelegram((value) => value.stage === "connecting"
      ? { ...value, stage: "error", error: "Telegram is taking too long to respond. Check the connection and try again." }
      : value), 15_000);
    return () => window.clearTimeout(timeout);
  }, [telegram.stage]);

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  }, [url]);

  async function pasteLink() {
    try {
      const value = await navigator.clipboard.readText();
      setUrl(value);
      setInfo(null);
      setStatus("idle");
    } catch {
      setMessage("Clipboard access is blocked. Paste with Ctrl + V.");
      setStatus("error");
    }
  }

  async function inspect(event: FormEvent) {
    event.preventDefault();
    setInfo(null);
    setStatus("fetching");
    setMessage("");
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, browser })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read this link.");
      setInfo(data);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not read this link.");
    }
  }

  async function downloadMedia() {
    if (!info) return;
    setStatus("downloading");
    setMessage("");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode, quality, browser })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Download failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `${info.title}.${mode === "audio" ? "mp3" : "mp4"}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus("done");
      window.setTimeout(() => setStatus("ready"), 2600);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function startTelegram(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const response = await fetch("/api/telegram/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(telegramForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTelegram(data);
      await refreshTelegram();
    } catch (error) { setTelegram((value) => ({ ...value, stage: "error", error: error instanceof Error ? error.message : "Login failed." })); }
    finally { setAuthBusy(false); }
  }

  async function submitTelegram(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const response = await fetch("/api/telegram/input", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: telegram.stage, value: telegramForm.input }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTelegramForm((value) => ({ ...value, input: "" }));
      setTelegram(data);
    } catch (error) { setTelegram((value) => ({ ...value, error: error instanceof Error ? error.message : "Could not continue." })); }
    finally { setAuthBusy(false); }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3e8] text-[#171717]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%22.8%22/%3E%3C/svg%3E')]" />

      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a className="flex items-center gap-2.5" href="#top" aria-label="Droply home">
          <span className="grid h-10 w-10 -rotate-3 place-items-center rounded-xl border-2 border-black bg-[#d8ff65] shadow-[3px_3px_0_#171717]">
            <ArrowDownToLine size={21} strokeWidth={2.8} />
          </span>
          <span className="text-xl font-black tracking-[-0.06em]">droply!</span>
        </a>
        <div className="hidden items-center gap-7 text-sm font-bold sm:flex">
          <a href="#how" className="transition hover:-translate-y-0.5">How it works</a>
          <a href="#support" className="transition hover:-translate-y-0.5">Supported</a>
          <button onClick={() => setPrivateOpen(true)} className="flex items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1.5 text-xs shadow-[2px_2px_0_#171717]"><LockKeyhole size={13} /> Private access</button>
        </div>
      </nav>

      <section id="top" className="relative mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#ff9acb] blur-[1px]" />
        <div className="absolute -right-28 top-6 h-72 w-72 rounded-full bg-[#91b5ff]" />
        <div className="absolute right-[11%] top-24 hidden rotate-12 rounded-full border-2 border-black bg-[#ffdf67] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#171717] lg:block">ZERO WATERMARK*</div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] shadow-[3px_3px_0_#171717]">
            <Sparkles size={14} fill="#ffdf67" /> Your links. Your files.
          </div>
          <h1 className="text-[clamp(3.25rem,9vw,7.6rem)] font-black leading-[0.84] tracking-[-0.085em]">
            Save the <span className="relative inline-block text-[#6147ff]">good stuff<span className="absolute -bottom-1 left-1 right-0 h-3 -rotate-1 rounded-full bg-[#d8ff65] -z-10" /></span>.
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base font-semibold leading-relaxed text-black/65 sm:text-lg">
            Paste a public post. Grab the video, image or audio. No sketchy pop-ups, no account, no drama.
          </p>

          <form onSubmit={inspect} className="mx-auto mt-9 max-w-3xl rounded-[28px] border-2 border-black bg-white p-3 shadow-[8px_8px_0_#171717] sm:flex sm:items-center sm:gap-3 sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
              <Link2 className="shrink-0 text-[#6147ff]" size={22} />
              <input
                value={url}
                onChange={(event) => { setUrl(event.target.value); setInfo(null); setStatus("idle"); }}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-black/35 sm:text-base"
                placeholder="Paste TikTok, IG, Facebook or Telegram link..."
                type="url"
                required
                aria-label="Post URL"
              />
              {url ? <button type="button" onClick={() => { setUrl(""); setInfo(null); }} aria-label="Clear link" className="rounded-full p-1 hover:bg-black/5"><X size={18} /></button> : null}
              <button type="button" onClick={pasteLink} className="hidden items-center gap-1.5 rounded-xl bg-black/5 px-3 py-2 text-xs font-black hover:bg-black/10 sm:flex"><Clipboard size={14} /> Paste</button>
            </div>
            <button disabled={status === "fetching" || !url} className="mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-2xl border-2 border-black bg-[#d8ff65] px-6 py-3.5 text-sm font-black shadow-[3px_3px_0_#171717] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#171717] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0 sm:w-auto">
              {status === "fetching" ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />} Get media
            </button>
          </form>

          <div id="support" className="mt-7 flex flex-wrap justify-center gap-2.5">
            {platforms.map(({ name, icon: Icon, color }) => (
              <span key={name} className={`flex items-center gap-2 rounded-full border-2 border-black px-3 py-1.5 text-xs font-black ${color}`}><Icon size={14} />{name}</span>
            ))}
            <button type="button" onClick={() => setPrivateOpen(true)} className={`flex items-center gap-2 rounded-full border-2 border-black px-3 py-1.5 text-xs font-black ${browser !== "none" || telegram.stage === "ready" ? "bg-[#d8ff65]" : "bg-white"}`}><LockKeyhole size={14} />{browser !== "none" || telegram.stage === "ready" ? "Private access on" : "Use private access"}</button>
          </div>
        </div>

        {(message || info) && (
          <div className="relative z-10 mx-auto mt-10 max-w-3xl">
            {message ? (
              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-[#ffb8ad] p-4 text-left font-bold shadow-[5px_5px_0_#171717]"><X className="mt-0.5 shrink-0" size={19} /><p>{message}</p></div>
            ) : info ? (
              <div className="overflow-hidden rounded-[28px] border-2 border-black bg-white text-left shadow-[8px_8px_0_#171717]">
                <div className="grid sm:grid-cols-[220px_1fr]">
                  <div className="relative min-h-44 overflow-hidden bg-[#e7e0ff]">
                    {info.thumbnail ? <img src={info.thumbnail} alt="Post preview" className="absolute inset-0 h-full w-full object-cover" /> : <div className="grid h-full min-h-44 place-items-center"><Film size={44} /></div>}
                    <span className="absolute bottom-3 left-3 rounded-full border border-black bg-white px-2.5 py-1 text-[11px] font-black">{formatDuration(info.duration)}</span>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#6147ff]"><Check size={15} strokeWidth={3} /> Ready to save</div>
                    <h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight tracking-tight">{info.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-black/50">{info.uploader || hostname} · {info.platform}{info.itemCount && info.itemCount > 1 ? ` · ${info.itemCount} items · downloads as ZIP` : ""}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <label className="relative"><span className="sr-only">File type</span><select value={mode} onChange={(e) => setMode(e.target.value as "video" | "audio")} className="h-12 w-full appearance-none rounded-xl border-2 border-black bg-[#f7f3e8] px-3 pr-8 text-sm font-black outline-none"><option value="video">Video / image</option><option value="audio">Audio only</option></select><ChevronDown className="pointer-events-none absolute right-3 top-4" size={16} /></label>
                      <label className="relative"><span className="sr-only">Quality</span><select value={quality} onChange={(e) => setQuality(e.target.value)} className="h-12 w-full appearance-none rounded-xl border-2 border-black bg-[#f7f3e8] px-3 pr-8 text-sm font-black outline-none"><option value="best">Best quality</option><option value="1080">Up to 1080p</option><option value="720">Up to 720p</option><option value="480">Up to 480p</option></select><ChevronDown className="pointer-events-none absolute right-3 top-4" size={16} /></label>
                      <button onClick={downloadMedia} disabled={status === "downloading"} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#6147ff] px-5 text-sm font-black text-white shadow-[3px_3px_0_#171717] transition hover:-translate-y-0.5 disabled:opacity-60">{status === "downloading" ? <Loader2 className="animate-spin" size={18} /> : status === "done" ? <Check size={18} /> : <Download size={18} />}{status === "downloading" ? "Saving..." : status === "done" ? "Saved!" : "Download"}</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section id="how" className="relative border-y-2 border-black bg-[#171717] px-5 py-18 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#d8ff65]">Ridiculously easy</p><h2 className="mt-2 text-4xl font-black tracking-[-0.055em] sm:text-6xl">Paste. Pick. Poof.</h2></div>
            <p className="max-w-sm text-sm font-semibold leading-relaxed text-white/55">Everything runs from this computer. Your links are not stored in a cloud account.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              ["01", Link2, "Drop the link", "Copy a public post URL from your favourite social app."],
              ["02", Play, "Choose your vibe", "Keep the best video, a smaller version, or just the audio."],
              ["03", ArrowDownToLine, "Save it locally", "The file lands straight in your Downloads folder."]
            ].map(([number, Icon, title, body], index) => {
              const Component = Icon as typeof Link2;
              return <article key={String(number)} className={`rounded-3xl border-2 border-white/25 p-6 ${index === 1 ? "md:-rotate-1 bg-[#6147ff]" : "bg-white/5"}`}><div className="flex items-center justify-between"><span className="text-xs font-black text-[#d8ff65]">{String(number)}</span><Component size={23} /></div><h3 className="mt-12 text-xl font-black">{String(title)}</h3><p className="mt-2 text-sm font-medium leading-relaxed text-white/60">{String(body)}</p></article>;
            })}
          </div>
        </div>
      </section>

      <footer className="bg-[#f7f3e8] px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-bold sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><ShieldCheck size={17} /> Private by default. Made for your own network.</span>
          <p className="max-w-xl text-xs font-semibold leading-relaxed text-black/50 sm:text-right">Only download media you own or have permission to save. Private, protected and DRM content is not supported. *Watermark removal depends on the source provided by the platform.</p>
        </div>
      </footer>

      {privateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Private access settings">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border-2 border-black bg-[#f7f3e8] shadow-[9px_9px_0_#171717]">
            <div className="flex items-start justify-between border-b-2 border-black bg-[#d8ff65] p-5 sm:p-6">
              <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em]"><ShieldCheck size={16} /> Stays on this PC</div><h2 className="mt-1 text-2xl font-black tracking-tight">Private access</h2></div>
              <button onClick={() => setPrivateOpen(false)} className="rounded-full border-2 border-black bg-white p-2 shadow-[2px_2px_0_#171717]" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
              <section className="rounded-2xl border-2 border-black bg-white p-5">
                <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff9acb]"><Instagram size={18} /></span><div><h3 className="font-black">Social browser login</h3><p className="text-xs font-semibold text-black/50">TikTok · Instagram · Facebook</p></div></div>
                <p className="mt-4 text-sm font-semibold leading-relaxed text-black/60">Login normally in your browser, open the private post once, then select that browser here.</p>
                <label className="mt-4 block text-xs font-black uppercase tracking-wider">Logged-in browser</label>
                <select value={browser} onChange={(event) => setBrowser(event.target.value)} className="mt-2 h-12 w-full rounded-xl border-2 border-black bg-[#f7f3e8] px-3 text-sm font-black outline-none">
                  <option value="none">Public mode only</option><option value="chrome">Google Chrome</option><option value="edge">Microsoft Edge</option><option value="firefox">Mozilla Firefox</option><option value="brave">Brave</option>
                </select>
                {browser !== "none" && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#3f7d00]"><Check size={15} /> Browser session enabled</p>}
              </section>

              <section className="rounded-2xl border-2 border-black bg-white p-5">
                <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#a9dcff]"><Send size={18} /></span><div><h3 className="font-black">Telegram channel</h3><p className="text-xs font-semibold text-black/50">Official user-session login</p></div></div>
                {telegram.stage === "ready" ? (
                  <div className="mt-5 rounded-xl border-2 border-black bg-[#d8ff65] p-4"><p className="text-xs font-black uppercase tracking-wider">Connected locally</p><p className="mt-1 font-black">{telegram.name || "Telegram account"}</p><p className="mt-2 text-xs font-semibold text-black/55">You can now paste direct message links from channels this account has joined.</p></div>
                ) : telegram.stage === "code" || telegram.stage === "password" ? (
                  <form onSubmit={submitTelegram} className="mt-5"><label className="text-xs font-black uppercase tracking-wider">{telegram.stage === "code" ? "Telegram login code" : "Two-step verification password"}</label><input autoFocus value={telegramForm.input} onChange={(e) => setTelegramForm({ ...telegramForm, input: e.target.value })} type={telegram.stage === "password" ? "password" : "text"} className="mt-2 h-12 w-full rounded-xl border-2 border-black px-3 font-bold outline-none" required /><button disabled={authBusy} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#6147ff] font-black text-white">{authBusy && <Loader2 className="animate-spin" size={16} />} Continue</button></form>
                ) : (
                  <form onSubmit={startTelegram} className="mt-4 space-y-3">
                    <p className="text-xs font-semibold leading-relaxed text-black/55">On this PC, get API ID and hash from <a className="font-black text-[#6147ff] underline" href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a> → API development tools. For safety, connect through localhost—not another network device.</p>
                    <div className="grid grid-cols-2 gap-2"><input value={telegramForm.apiId} onChange={(e) => setTelegramForm({ ...telegramForm, apiId: e.target.value })} placeholder="API ID" inputMode="numeric" className="h-11 rounded-xl border-2 border-black px-3 text-sm font-bold outline-none" required /><input value={telegramForm.apiHash} onChange={(e) => setTelegramForm({ ...telegramForm, apiHash: e.target.value })} placeholder="API hash" type="password" className="h-11 rounded-xl border-2 border-black px-3 text-sm font-bold outline-none" required /></div>
                    <input value={telegramForm.phone} onChange={(e) => setTelegramForm({ ...telegramForm, phone: e.target.value })} placeholder="+60123456789" type="tel" className="h-11 w-full rounded-xl border-2 border-black px-3 text-sm font-bold outline-none" required />
                    <button disabled={authBusy || telegram.stage === "connecting"} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#a9dcff] font-black shadow-[2px_2px_0_#171717]">{(authBusy || telegram.stage === "connecting") && <Loader2 className="animate-spin" size={16} />} Send login code</button>
                  </form>
                )}
                {telegram.error && <p className="mt-3 rounded-lg bg-[#ffb8ad] p-2 text-xs font-bold">{telegram.error}</p>}
              </section>
            </div>
            <p className="border-t-2 border-black px-5 py-4 text-center text-[11px] font-semibold text-black/45">Access only works for posts your own account is allowed to view. Droply does not bypass membership, bans, DRM or platform restrictions.</p>
          </div>
        </div>
      )}
    </main>
  );
}
