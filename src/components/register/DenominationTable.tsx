"use client";

import { DENOMINATIONS, sumCashCounts, type CashCounts } from "@/lib/denominations";
import { yen } from "@/lib/money";

// 金種ごとの枚数入力。レジ開け(釣銭準備金)とレジ締め(実査)の両方で使う。
export function DenominationTable({
  counts,
  onChange,
}: {
  counts: CashCounts;
  onChange: (next: CashCounts) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {DENOMINATIONS.map((denom) => {
          const n = counts[denom] ?? 0;
          return (
            <div key={denom} className="rounded-md border border-border px-2.5 py-2">
              <div className="text-[11px] font-bold text-ink-muted">
                ¥{denom.toLocaleString("ja-JP")}
              </div>
              <input
                type="number"
                min={0}
                value={counts[denom] ?? ""}
                onChange={(e) => onChange({ ...counts, [denom]: Number(e.target.value || 0) })}
                className="num w-full border-b border-border bg-transparent text-base outline-none focus:border-accent"
              />
              <div className="num mt-0.5 text-right text-[11px] text-ink-muted">
                {yen(denom * n)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[13px] font-bold">合計</span>
        <span className="num text-[26px] font-bold">{yen(sumCashCounts(counts))}</span>
      </div>
    </div>
  );
}
