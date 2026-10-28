import { describe, expect, it } from "vitest";
import { handleIngest, readPayload, readToken, type RpcClient } from "@/lib/sms/handle";

const TOKEN = "k".repeat(40);
const today = "2026-10-28";

function fake(result: { data?: unknown; error?: { message: string; code?: string } | null } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client: RpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: result.data ?? { status: "review" }, error: result.error ?? null };
    },
  };
  return { client, calls };
}
const req = (raw: string, headers: Record<string, string> = {}, contentType: string | null = "application/json") =>
  ({ raw, contentType, headers: new Headers(headers), today });

describe("readPayload / readToken", () => {
  it("accepts JSON with several field names, raw text and form bodies", () => {
    expect(readPayload('{"message":"hi","sender":"AlRajhi"}', "application/json")).toMatchObject({ text: "hi", sender: "AlRajhi" });
    expect(readPayload('{"text":"a","token":"t"}', null)).toMatchObject({ text: "a", token: "t" });
    expect(readPayload("plain message", "text/plain").text).toBe("plain message");
    expect(readPayload("text=%D8%B4%D8%B1%D8%A7%D8%A1&sender=X", "application/x-www-form-urlencoded")).toMatchObject({ text: "شراء", sender: "X" });
  });
  it("reads the token from the Authorization header, a custom header, or the body", () => {
    expect(readToken(new Headers({ Authorization: "Bearer abc" }))).toBe("abc");
    expect(readToken(new Headers({ "x-ingest-token": "def" }))).toBe("def");
    expect(readToken(new Headers(), "ghi")).toBe("ghi");
    expect(readToken(new Headers())).toBeNull();
  });
});

describe("handleIngest", () => {
  const msg = "شراء بمبلغ 45.50 SAR لدى STARBUCKS\nبطاقة: 1234";

  it("parses the message and calls the ingest function with the token", async () => {
    const { client, calls } = fake();
    const r = await handleIngest(req(JSON.stringify({ text: msg }), { Authorization: `Bearer ${TOKEN}` }), client);
    expect(r).toEqual({ status: 200, json: { ok: true, status: "review" } });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("ingest_sms");
    expect(calls[0].args).toMatchObject({
      p_token: TOKEN, p_direction: "purchase", p_amount: 4550, p_merchant: "STARBUCKS", p_merchant_key: "starbucks",
      p_card: "1234", p_hint: "قهوة",
    });
  });

  it("rejects a request with no token before touching the database", async () => {
    const { client, calls } = fake();
    const r = await handleIngest(req(JSON.stringify({ text: msg })), client);
    expect(r.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("maps a bad token from the database to 401 without leaking details", async () => {
    const { client } = fake({ error: { message: "invalid token", code: "28000" } });
    const r = await handleIngest(req(JSON.stringify({ text: msg }), { "x-ingest-token": TOKEN }), client);
    expect(r).toEqual({ status: 401, json: { ok: false, error: "unauthorized" } });
  });

  it("maps other database failures to a generic 500", async () => {
    const { client } = fake({ error: { message: "connection refused to 10.0.0.5" } });
    const r = await handleIngest(req(JSON.stringify({ text: msg }), { "x-ingest-token": TOKEN }), client);
    expect(r).toEqual({ status: 500, json: { ok: false, error: "server" } });
  });

  it("skips OTP and promo messages without storing them", async () => {
    const { client, calls } = fake();
    const r = await handleIngest(req(JSON.stringify({ text: "رمز التحقق 482913 لا تشاركه" }), { "x-ingest-token": TOKEN }), client);
    expect(r).toEqual({ status: 200, json: { ok: true, status: "skipped" } });
    expect(calls).toHaveLength(0);
  });

  it("rejects an empty body and caps very long text", async () => {
    const { client, calls } = fake();
    expect((await handleIngest(req(JSON.stringify({ text: "  " }), { "x-ingest-token": TOKEN }), client)).status).toBe(400);
    await handleIngest(req(JSON.stringify({ text: `${msg} ${"x".repeat(10_000)}` }), { "x-ingest-token": TOKEN }), client);
    expect(String(calls[0].args.p_raw).length).toBeLessThanOrEqual(4000);
  });

  it("uses the sender to recognise the bank", async () => {
    const { client, calls } = fake();
    await handleIngest(req(JSON.stringify({ text: "شراء بمبلغ 10 SAR لدى X", sender: "AlRajhiBank" }), { "x-ingest-token": TOKEN }), client);
    expect(calls[0].args.p_bank).toBe("الراجحي");
  });
});
