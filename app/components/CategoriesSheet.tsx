"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { Field } from "./ui";
import { useFinance } from "@/hooks/useFinance";
import type { Category } from "@/lib/types";

export default function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const { categories, lines } = useFinance();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  return (
    <Sheet open onClose={onClose} title={editing === null ? "التصنيفات" : editing === "new" ? "تصنيف جديد" : "تعديل تصنيف"}>
      {editing === null ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-sm leading-6 text-mut">اربط كل تصنيف ببند. اللي بدون بند يُحسب على بند المصاريف اليومي.</p>
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id}>
                <button onClick={() => setEditing(c)} className="flex w-full items-center gap-3 py-3 text-start">
                  <span aria-hidden>{c.emoji}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-mut">{lines.find((l) => l.id === c.line_id)?.name ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setEditing("new")} className="rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">＋ أضف تصنيف</button>
        </div>
      ) : (
        <CategoryForm cat={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}
    </Sheet>
  );
}

function CategoryForm({ cat, onDone }: { cat: Category | null; onDone: () => void }) {
  const { categories, lines, saveCategory, deleteCategory } = useFinance();
  const [name, setName] = useState(cat?.name ?? "");
  const [emoji, setEmoji] = useState(cat?.emoji ?? "📌");
  const [lineId, setLineId] = useState(cat?.line_id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("اكتب اسم التصنيف");
    setBusy(true);
    const ok = await saveCategory({
      id: cat?.id, name: name.trim(), emoji: emoji.trim() || "📌", line_id: lineId || null,
      sort: cat?.sort ?? categories.reduce((m, c) => Math.max(m, c.sort), -1) + 1,
    });
    setBusy(false);
    if (ok) onDone();
  }

  async function remove() {
    if (!cat) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    const ok = await deleteCategory(cat.id);
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div>
          <label htmlFor="c-emoji" className="mb-1.5 block text-sm">رمز</label>
          <input id="c-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4}
            className="w-full rounded-2xl border border-line bg-bg px-3 py-3 text-center text-xl" />
        </div>
        <Field id="c-name" label="الاسم" mode="text" value={name} onChange={setName} />
      </div>
      <div>
        <label htmlFor="c-line" className="mb-1.5 block text-sm">البند</label>
        <select id="c-line" value={lineId} onChange={(e) => setLineId(e.target.value)}
          className="w-full rounded-2xl border border-line bg-bg px-4 py-3">
          <option value="">بدون بند (يُحسب على بند المصاريف)</option>
          {lines.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
        </select>
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-2xl bg-acc px-4 py-3.5 font-semibold text-onacc">{busy ? "لحظة…" : "حفظ"}</button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-soft px-4 py-3.5 text-mut">رجوع</button>
        {cat && (
          <button type="button" onClick={remove} disabled={busy}
            className={`rounded-2xl px-4 py-3.5 font-semibold ${confirmDelete ? "bg-bad text-white" : "bg-soft text-bad"}`}>
            {confirmDelete ? "تأكيد" : "حذف"}
          </button>
        )}
      </div>
      {confirmDelete && <p className="text-xs leading-5 text-mut">عملياتك القديمة بهالتصنيف تبقى وتصير بدون تصنيف.</p>}
    </form>
  );
}
