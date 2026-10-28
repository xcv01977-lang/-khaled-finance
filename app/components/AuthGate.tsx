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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "up" && password.length < 8) return setMsg("كلمة السر لازم تكون 8 خانات أو أكثر");
    setBusy(true); setMsg(null);
    const sb = getSupabase();
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg("البريد أو كلمة السر غلط");
    } else {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("تم إنشاء الحساب، لكن Supabase يطلب تأكيد البريد. عطّل Confirm email من إعدادات Authentication ثم سجّل دخولك.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-6">
      <div className="grid gap-2">
        <div className="text-4xl" aria-hidden>🌙</div>
        <h1 className="text-2xl font-semibold">{mode === "in" ? "أهلاً فيك" : "إنشاء حسابك"}</h1>
        <p className="text-mut leading-7">
          {mode === "in" ? "سجّل دخولك لتفتح ميزانك." : "أول مرة؟ اكتب بريدك واختر كلمة سر قوية (8 خانات أو أكثر)."}
        </p>
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <label htmlFor="email" className="sr-only">البريد الإلكتروني</label>
        <input
          id="email" type="email" required autoComplete="email" inputMode="email" dir="ltr"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          className="rounded-2xl border border-line bg-card px-4 py-3.5 text-lg"
        />
        <label htmlFor="password" className="sr-only">كلمة السر</label>
        <input
          id="password" type="password" required dir="ltr"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر"
          className="rounded-2xl border border-line bg-card px-4 py-3.5 text-lg"
        />
        <button disabled={busy} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">
          {busy ? "لحظة…" : mode === "in" ? "دخول" : "إنشاء الحساب"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="text-sm text-mut">
          {mode === "in" ? "أول مرة؟ أنشئ حسابك" : "عندي حساب، أدخل"}
        </button>
      </form>
      {msg && <p role="alert" className="text-sm leading-6 text-bad">{msg}</p>}
    </main>
  );
}
