import { telegramStatus } from "../../_lib/telegram";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json(await telegramStatus()); }
