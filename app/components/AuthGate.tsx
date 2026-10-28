"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { IS_DEMO } from "@/lib/repo";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase";

type Phase = "checking" | "out" | "in";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(IS_DEMO ? "in" : hasSupabaseEnv() ? "checking" : "out");

  useEffect(() => {
    if (IS_DEMO || !hasSupabaseEnv()) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setPhase(data.session ? "in" : "out"));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setPhase(session ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  if (phase === "checking") return <div className="grid min-h-dvh place-items-center text-mut">لحظة…</div>;
  if (phase === "out") return <Login />;
  return <>{children}</>;
}

function Login() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm place-content-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">الإعداد ناقص</h1>
        <p className="text-mut leading-7">
          ما لقيت مفاتيح Supabase. أنشئ ملف <span className="num">.env.local</span> وحط فيه
          <span className="num"> NEXT_PUBLIC_SUPABASE_URL </span> و
          <span className="num"> NEXT_PUBLIC_SUPABASE_ANON_KEY</span>، كما في README.
        </p>
      </main>
    );
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await getSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMsg(error.message);
    else setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMsg("الكود غلط أو انتهت صلاحيته");
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-6">
      <div className="grid gap-2">
        <div className="text-4xl" aria-hidden>🌙</div>
        <h1 className="text-2xl font-semibold">أهلاً فيك</h1>
        <p className="text-mut leading-7">
          {step === "email" ? "اكتب بريدك وأرسل لك كود دخول." : <>أرسلنا كود إلى <span className="num">{email}</span></>}
        </p>
      </div>
      {step === "email" ? (
        <form onSubmit={sendCode} className="grid gap-3">
          <label htmlFor="email" className="sr-only">البريد الإلكتروني</label>
          <input
            id="email" type="email" required autoComplete="email" inputMode="email" dir="ltr"
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="rounded-2xl border border-line bg-card px-4 py-3.5 text-lg"
          />
          <button disabled={busy} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">
            {busy ? "لحظة…" : "أرسل الكود"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="grid gap-3">
          <label htmlFor="code" className="sr-only">كود الدخول</label>
          <input
            id="code" required autoComplete="one-time-code" inputMode="numeric" dir="ltr" maxLength={10}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••"
            className="rounded-2xl border border-line bg-card px-4 py-3.5 text-center text-2xl tracking-[.4em]"
          />
          <button disabled={busy || code.length < 6} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">
            {busy ? "لحظة…" : "دخول"}
          </button>
          <button type="button" onClick={() => { setStep("email"); setCode(""); setMsg(null); }} className="text-sm text-mut">
            غيّر البريد
          </button>
        </form>
      )}
      {msg && <p role="alert" className="text-sm text-bad">{msg}</p>}
    </main>
  );
}
