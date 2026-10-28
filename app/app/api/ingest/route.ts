import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { todayRiyadh } from "@/lib/cycle";
import { handleIngest } from "@/lib/sms/handle";

export const dynamic = "force-dynamic";

// Called by the iPhone Shortcut. The secret token in the request is the only credential; the database
// function it calls can write one thing (a parsed message) and nothing else is reachable through it.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "server" }, { status: 500 });

  const raw = (await req.text()).slice(0, 16_000);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const out = await handleIngest(
    { raw, contentType: req.headers.get("content-type"), headers: req.headers, today: todayRiyadh() },
    client,
  );
  return NextResponse.json(out.json, { status: out.status });
}

export function GET() {
  return NextResponse.json({ ok: false, error: "POST only" }, { status: 405 });
}
