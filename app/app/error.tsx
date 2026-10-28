"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-content-center gap-4 px-6 text-center">
      <div className="text-4xl" aria-hidden>🌙</div>
      <h1 className="text-xl font-semibold">صار خطأ غير متوقع</h1>
      <p className="leading-7 text-mut">بياناتك محفوظة وما تأثرت. جرّب مرة ثانية.</p>
      <button onClick={reset} className="rounded-2xl bg-acc px-4 py-3 font-semibold text-onacc">حاول مرة ثانية</button>
    </main>
  );
}
