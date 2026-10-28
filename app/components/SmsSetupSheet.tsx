"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useFinance } from "@/hooks/useFinance";

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function newToken() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = hex(raw);
  const hash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return { token, hash };
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { setDone(false); }
  }
  return (
    <div>
      <div className="mb-1 text-sm">{label}</div>
      <div className="flex items-stretch gap-2">
        <input readOnly dir="ltr" value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()}
          className="num min-w-0 flex-1 rounded-2xl border border-line bg-bg px-3 py-2.5 text-xs" />
        <button onClick={copy} className="shrink-0 rounded-2xl bg-soft px-4 text-sm">{done ? "تم ✓" : "نسخ"}</button>
      </div>
    </div>
  );
}

export default function SmsSetupSheet({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings } = useFinance();
  const [token, setToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasToken = Boolean(settings.ingest_token_hash);
  const endpoint = typeof window === "undefined" ? "" : `${window.location.origin}/api/ingest`;

  async function generate() {
    if (hasToken && !confirm) return setConfirm(true);
    setBusy(true);
    const { token: t, hash } = await newToken();
    const ok = await saveSettings({ ...settings, ingest_token_hash: hash });
    setBusy(false);
    if (ok) { setToken(t); setConfirm(false); }
  }

  async function revoke() {
    setBusy(true);
    const ok = await saveSettings({ ...settings, ingest_token_hash: null });
    setBusy(false);
    if (ok) setToken(null);
  }

  return (
    <Sheet open onClose={onClose} title="ربط رسائل البنك">
      <div className="grid gap-5">
        <p className="text-sm leading-7 text-mut">
          اختصار في الآيفون يرسل لي رسائل البنك أول ما توصلك. المفتاح هو اللي يثبت إنها منك،
          وأنا أحفظ بصمته بس، فلو ضاع المفتاح تسوي واحد جديد.
        </p>

        {token ? (
          <div className="grid gap-3 rounded-2xl border border-acc p-3.5">
            <p className="text-sm leading-6">انسخ المفتاح الحين. <b>يظهر مرة وحدة</b> وبعدها ما أقدر أعرضه.</p>
            <CopyBox label="مفتاح الربط" value={token} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={generate} disabled={busy}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${confirm ? "bg-bad text-white" : "bg-acc text-onacc"}`}>
              {confirm ? "تأكيد: المفتاح القديم يوقف" : hasToken ? "مفتاح جديد" : "أنشئ مفتاح الربط"}
            </button>
            {hasToken && !confirm && (
              <>
                <span className="text-sm text-ok">✓ فيه مفتاح شغّال</span>
                <button onClick={revoke} disabled={busy} className="rounded-2xl bg-soft px-3 py-2 text-xs text-bad">إيقاف الربط</button>
              </>
            )}
          </div>
        )}

        <CopyBox label="رابط الاستقبال" value={endpoint} />

        <details className="rounded-2xl bg-bg p-3.5">
          <summary className="cursor-pointer text-sm font-medium">خطوات الاختصار (آيفون)</summary>
          <ol className="mt-3 grid list-decimal gap-2.5 ps-5 text-sm leading-7">
            <li>افتح تطبيق <b>الاختصارات</b> (Shortcuts) ← تبويب <b>الأتمتة</b> (Automation) ← زر <b>＋</b> ← <b>رسالة</b> (Message).</li>
            <li>في <b>المرسل</b> اختر جهات البنك اللي تجيك منها الرسائل (الراجحي، الأهلي…). أو اختر «الرسالة تحتوي» واكتب <span className="num">SAR</span>. ما تحتاج تضيف كل البنوك مرة وحدة.</li>
            <li>اختر <b>تشغيل فوري</b> (Run Immediately) وعطّل <b>إشعار عند التشغيل</b>. ثم <b>التالي</b>.</li>
            <li>اختر <b>أتمتة جديدة فارغة</b>، واضغط <b>إضافة إجراء</b> وابحث عن <b>الحصول على محتويات عنوان URL</b> (Get Contents of URL).</li>
            <li>الصق <b>رابط الاستقبال</b> أعلاه في خانة URL، واضغط على السهم لإظهار الخيارات:</li>
            <li className="list-none ps-0">
              <ul className="grid list-disc gap-1.5 ps-5">
                <li><b>الطريقة</b> (Method): <span className="num">POST</span></li>
                <li><b>الرؤوس</b> (Headers): أضف رأساً اسمه <span className="num">Authorization</span> وقيمته <span className="num">Bearer </span> ثم مفتاح الربط (بمسافة بعد كلمة Bearer).</li>
                <li><b>نص الطلب</b> (Request Body): <b>JSON</b>. أضف حقل نص اسمه <span className="num">text</span> وقيمته المتغير <b>مدخل الاختصار</b> (Shortcut Input). حقل ثاني اختياري اسمه <span className="num">sender</span> وقيمته <b>المرسل</b> (Sender) يساعدني أعرف البنك.</li>
              </ul>
            </li>
            <li>اضغط <b>تم</b>. اختبر بأول رسالة تصلك، وتشوفها هنا في «رسائل البنك».</li>
          </ol>
          <p className="mt-3 text-xs leading-6 text-mut">
            أسماء الخيارات تختلف شوي بين إصدارات iOS. لو وصلت رسالة وما ظهرت هنا، جرّب لصقها بخانة التجربة أول،
            وبكذا تعرف إن المشكلة في الاختصار وليس في التحليل.
          </p>
        </details>
      </div>
    </Sheet>
  );
}
