import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import type { EntityLike } from "telegram/define";

type Stage = "offline" | "connecting" | "code" | "password" | "ready" | "error";
type PendingInput = { kind: "code" | "password"; resolve: (value: string) => void } | null;

const root = path.join(process.cwd(), ".droply");
const sessionPath = path.join(root, "telegram-session.txt");
const configPath = path.join(root, "telegram-config.json");

const state = globalThis as typeof globalThis & {
  droplyTelegram?: { client: TelegramClient | null; stage: Stage; error: string; name: string; pending: PendingInput; task: Promise<void> | null };
};

export const telegramState = state.droplyTelegram ??= { client: null, stage: "offline", error: "", name: "", pending: null, task: null };

async function savedSession() {
  try { return (await readFile(sessionPath, "utf8")).trim(); } catch { return ""; }
}

async function savedConfig() {
  try { return JSON.parse(await readFile(configPath, "utf8")) as { apiId: number; apiHash: string }; } catch { return null; }
}

function waitFor(kind: "code" | "password") {
  telegramState.stage = kind;
  return new Promise<string>((resolve) => { telegramState.pending = { kind, resolve }; });
}

export async function telegramStatus() {
  if (telegramState.stage === "ready" && telegramState.client) return publicStatus();
  const config = await savedConfig();
  const session = await savedSession();
  if (config && session && !telegramState.task) {
    telegramState.stage = "connecting";
    telegramState.task = (async () => {
      try {
        const client = new TelegramClient(new StringSession(session), config.apiId, config.apiHash, { connectionRetries: 1 });
        await client.connect();
        if (await client.checkAuthorization()) {
          telegramState.client = client;
          const me = await client.getMe();
          telegramState.name = "firstName" in me ? [me.firstName, me.lastName].filter(Boolean).join(" ") : "Telegram user";
          telegramState.stage = "ready";
        } else telegramState.stage = "offline";
      } catch (error) {
        telegramState.error = error instanceof Error ? error.message : "Could not restore Telegram session.";
        telegramState.stage = "error";
      } finally { telegramState.task = null; }
    })();
    await telegramState.task;
  }
  return publicStatus();
}

function publicStatus() {
  return { stage: telegramState.stage, error: telegramState.error, name: telegramState.name, configured: telegramState.stage === "ready" };
}

export async function startTelegramLogin(apiIdValue: unknown, apiHashValue: unknown, phoneValue: unknown) {
  if (telegramState.task) throw new Error("Telegram login is already in progress.");
  const apiId = Number(apiIdValue);
  const apiHash = String(apiHashValue || "").trim();
  const phone = String(phoneValue || "").replace(/\s/g, "");
  if (!Number.isInteger(apiId) || apiId <= 0 || apiHash.length < 20 || !/^\+\d{7,15}$/.test(phone)) throw new Error("Enter a valid API ID, API hash and phone number with country code.");
  telegramState.stage = "connecting";
  telegramState.error = "";
  await mkdir(root, { recursive: true });
  await writeFile(configPath, JSON.stringify({ apiId, apiHash }), { encoding: "utf8", mode: 0o600 });
  telegramState.task = (async () => {
    try {
      const session = new StringSession(await savedSession());
      const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 1 });
      telegramState.client = client;
      await client.start({
        phoneNumber: phone,
        phoneCode: () => waitFor("code"),
        password: () => waitFor("password"),
        onError: async (error) => { telegramState.error = error.message; return false; }
      });
      const me = await client.getMe();
      telegramState.name = "firstName" in me ? [me.firstName, me.lastName].filter(Boolean).join(" ") : "Telegram user";
      await writeFile(sessionPath, session.save(), { encoding: "utf8", mode: 0o600 });
      telegramState.stage = "ready";
      telegramState.pending = null;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Telegram login failed.";
      telegramState.error = /TIMEOUT|EACCES|connect/i.test(rawMessage)
        ? "Telegram could not be reached. Check the internet connection, then press Send login code again."
        : rawMessage;
      telegramState.stage = "error";
      telegramState.pending = null;
    } finally { telegramState.task = null; }
  })();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return publicStatus();
}

export function submitTelegramInput(kind: "code" | "password", value: unknown) {
  const input = String(value || "").trim();
  if (!input || telegramState.pending?.kind !== kind) throw new Error(`Telegram is not waiting for a ${kind}.`);
  const pending = telegramState.pending;
  telegramState.pending = null;
  telegramState.stage = "connecting";
  pending.resolve(input);
  return publicStatus();
}

export async function getTelegramMessage(urlValue: string) {
  await telegramStatus();
  const client = telegramState.client;
  if (!client || telegramState.stage !== "ready") throw new Error("Connect Telegram in Private access first.");
  const parsed = new URL(urlValue);
  const parts = parsed.pathname.split("/").filter(Boolean);
  let entity: EntityLike;
  let messageId: number;
  if (parts[0] === "c" && parts[1] && parts[2]) {
    const channelId = parts[1];
    const dialogs = await client.getDialogs({ limit: 500 });
    const dialog = dialogs.find((item) => {
      const candidate = item.entity && "id" in item.entity ? String(item.entity.id) : "";
      return candidate === channelId || candidate === `-100${channelId}`;
    });
    if (!dialog?.entity) throw new Error("This private channel is not visible in the connected Telegram account. Open or join the channel in Telegram, then retry.");
    entity = dialog.entity;
    messageId = Number(parts[2]);
  } else if (parts[0] && parts[1] && !["joinchat", "+"].includes(parts[0])) {
    entity = parts[0];
    messageId = Number(parts[1]);
  } else throw new Error("Paste a direct Telegram message link, not a channel invite link.");
  if (!Number.isInteger(messageId)) throw new Error("This Telegram link has no valid message number.");
  const messages = await client.getMessages(entity, { ids: messageId });
  const message = messages[0];
  if (!message || !message.media) throw new Error("No downloadable media was found in that Telegram post.");
  let group = [message];
  if (message.groupedId) {
    const nearbyIds = Array.from({ length: 31 }, (_, index) => messageId - 15 + index).filter((id) => id > 0);
    const nearby = await client.getMessages(entity, { ids: nearbyIds });
    const groupedId = String(message.groupedId);
    group = nearby
      .filter((item) => item?.media && item.groupedId && String(item.groupedId) === groupedId)
      .sort((a, b) => a.id - b.id);
  }
  return { client, message, messages: group };
}
