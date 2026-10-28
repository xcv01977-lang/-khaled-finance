import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-content-center gap-4 px-6 text-center">
      <div className="text-4xl" aria-hidden>🧭</div>
      <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
      <Link href="/" className="rounded-2xl bg-acc px-4 py-3 font-semibold text-onacc">الرئيسية</Link>
    </main>
  );
}
