import { submitTelegramInput } from "../../_lib/telegram";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const host = request.headers.get("host")?.split(":")[0];
  if (host !== "localhost" && host !== "127.0.0.1") return Response.json({ error: "For safety, enter Telegram codes from this PC using localhost." }, { status: 403 });
  try { const body = await request.json(); return Response.json(submitTelegramInput(body.kind, body.value)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not continue login." }, { status: 400 }); }
}
