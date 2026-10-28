"use client";

import Sheet from "./Sheet";
import TxList from "./TxList";
import { useFinance } from "@/hooks/useFinance";
import type { Tx } from "@/lib/types";

export default function TxListSheet({ onClose, onPick }: { onClose: () => void; onPick: (t: Tx) => void }) {
  const { txs, summary } = useFinance();
  const { start, end } = summary.cycle;
  const items = txs.filter((t) => t.occurred_on >= start && t.occurred_on <= end);
  return (
    <Sheet open onClose={onClose} title="عمليات هالدورة">
      <TxList items={items} onPick={onPick} />
    </Sheet>
  );
}
