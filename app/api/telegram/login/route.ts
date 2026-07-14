import { startTelegramLogin } from "../../_lib/telegram";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const host = request.headers.get("host")?.split(":")[0];
  if (host !== "localhost" && host !== "127.0.0.1") return Response.json({ error: "For safety, connect Telegram from this PC using localhost." }, { status: 403 });
  try { const body = await request.json(); return Response.json(await startTelegramLogin(body.apiId, body.apiHash, body.phone)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 400 }); }
}
