import { isFinancial, parseSms } from "./parse";

export type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type HandlerResult = { status: number; json: { ok: boolean; status?: string; error?: string } };

const MAX_TEXT = 4000;

/** Pull the message text and sender out of whatever shape the Shortcut sent. */
export function readPayload(raw: string, contentType: string | null): { text: string; sender?: string; token?: string } {
  const pick = (o: Record<string, unknown>) => ({
    text: String(o.text ?? o.message ?? o.body ?? o.content ?? ""),
    sender: o.sender != null ? String(o.sender) : o.from != null ? String(o.from) : undefined,
    token: o.token != null ? String(o.token) : undefined,
  });
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object" && !Array.isArray(j)) return pick(j as Record<string, unknown>);
    if (typeof j === "string") return { text: j };
  } catch {
    // not JSON: fall through
  }
  if (contentType?.includes("application/x-www-form-urlencoded")) return pick(Object.fromEntries(new URLSearchParams(raw)));
  return { text: raw };
}

export function readToken(headers: Headers, bodyToken?: string): string | null {
  const auth = headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  return (bearer ?? headers.get("x-ingest-token") ?? bodyToken ?? "").trim() || null;
}

export async function handleIngest(
  req: { raw: string; contentType: string | null; headers: Headers; today: string },
  client: RpcClient,
): Promise<HandlerResult> {
  const { text, sender, token: bodyToken } = readPayload(req.raw, req.contentType);
  const token = readToken(req.headers, bodyToken);
  if (!token) return { status: 401, json: { ok: false, error: "unauthorized" } };
  if (!text.trim()) return { status: 400, json: { ok: false, error: "empty" } };

  const message = text.slice(0, MAX_TEXT);
  const parsed = parseSms(message, { sender, today: req.today });
  // OTP codes, promotions and declined-card notices carry no amount: do not store them at all.
  if (!isFinancial(parsed)) return { status: 200, json: { ok: true, status: "skipped" } };

  const { data, error } = await client.rpc("ingest_sms", {
    p_token: token, p_raw: message, p_bank: parsed.bank, p_direction: parsed.direction, p_amount: parsed.amount_halalas,
    p_merchant: parsed.merchant, p_merchant_key: parsed.merchant_key, p_card: parsed.card_last4,
    p_date: parsed.occurred_on, p_hint: parsed.category_hint,
  });
  if (error) {
    const bad = error.code === "28000" || /invalid token/i.test(error.message);
    return { status: bad ? 401 : 500, json: { ok: false, error: bad ? "unauthorized" : "server" } };
  }
  return { status: 200, json: { ok: true, status: (data as { status: string }).status } };
}
