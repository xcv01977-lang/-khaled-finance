"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/** Bottom sheet over the home screen. Esc and a tap on the backdrop close it. */
export default function Sheet({ open, onClose, title, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  // Captured while rendering for the first time, before an autoFocus field inside the sheet takes the focus.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      // Keep Tab inside the sheet: wrap from the last control to the first and back.
      const items = [...panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    // Focus the panel itself unless a field inside already asked for focus (autoFocus runs first).
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      // Give focus back to what opened the sheet, if it is still on the page.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose, opener]);

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
