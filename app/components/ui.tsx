"use client";

import type { ReactNode } from "react";

export function Field({ id, label, hint, value, onChange, mode = "decimal", placeholder }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void;
  mode?: "decimal" | "numeric" | "text"; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm">{label}</label>
      <input
        id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode={mode} dir={mode === "text" ? undefined : "ltr"}
        autoComplete="off" placeholder={placeholder}
        className={`w-full rounded-2xl border border-line bg-bg px-4 py-3 text-start ${mode === "text" ? "" : "num"}`}
      />
      {hint && <p className="mt-1 text-xs leading-5 text-mut">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3 text-start text-sm">
      <span>{children}</span>
      <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${checked ? "bg-acc" : "bg-line"}`} aria-hidden>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "-translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${value === o.value ? "bg-acc font-semibold text-onacc" : "bg-soft text-mut"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Green for surplus, red for deficit, plain for zero. */
export const tone = (v: number) => (v > 0 ? "text-ok" : v < 0 ? "text-bad" : "");
