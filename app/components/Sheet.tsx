"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/** Bottom sheet over the home screen. Esc and a tap on the backdrop close it. */
export default function Sheet({ open, onClose, title, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
      <button aria-label="إغلاق" onClick={onClose} className="sheet-backdrop absolute inset-0 bg-black/50" />
      <div
        ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="sheet-panel relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none md:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full bg-soft text-mut">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
