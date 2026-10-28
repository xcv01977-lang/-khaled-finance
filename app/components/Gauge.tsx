import { fmt } from "@/lib/money";

const R = 52;
const C = 2 * Math.PI * R;

type Props = { allowed: number; daily: number; configured: boolean };

export default function Gauge({ allowed: exact, daily, configured }: Props) {
  // The big number is whole riyals; the exact value only drives the arc.
  const allowed = Math.round(exact / 100) * 100;
  const over = allowed < 0;
  const pct = configured && daily > 0 ? Math.min(1, Math.max(0, allowed / daily)) : 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[250px]" role="img"
      aria-label={configured ? `تقدر تصرف اليوم ${over ? "ناقص " : ""}${fmt(allowed)} ريال` : "ما حددت راتبك بعد"}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle
          cx="60" cy="60" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
          stroke={over ? "var(--bad)" : "var(--acc)"}
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1), stroke .3s" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-sm text-mut">تقدر تصرف اليوم</span>
        {configured ? (
          <>
            <span className={`num text-6xl font-medium leading-none ${over ? "text-bad" : ""}`}>
              {over ? "−" : ""}{fmt(allowed)}
            </span>
            <span className="mt-1 text-sm text-mut">
              ر.س{daily > 0 && <> · من <span className="num">{fmt(daily)}</span></>}
            </span>
          </>
        ) : (
          <span className="mt-1 text-4xl text-mut">—</span>
        )}
      </div>
    </div>
  );
}
