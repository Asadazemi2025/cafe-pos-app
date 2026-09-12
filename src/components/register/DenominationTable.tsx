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
      <div className="grid grid-cols-3 gap-2.5">
        {DENOMINATIONS.map((denom) => {
          const n = counts[denom] ?? 0;
          return (
            <div
              key={denom}
              className={`rounded-xl border px-3 py-2.5 ${
                n > 0 ? "border-accent bg-accent-weak" : "border-border"
              }`}
            >
              <div className="num text-[15px] font-bold">
                ¥{denom.toLocaleString("ja-JP")}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={counts[denom] ?? ""}
                  onChange={(e) => onChange({ ...counts, [denom]: Number(e.target.value || 0) })}
                  className="num w-full border-b-2 border-border bg-transparent py-1 text-right text-2xl font-bold outline-none placeholder:font-normal placeholder:text-ink-placeholder focus:border-accent"
                />
                <span className="shrink-0 text-xs text-ink-muted">枚</span>
              </div>
              <div className="num mt-1 text-right text-[13px] font-bold text-ink-muted">
                {yen(denom * n)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t-2 border-border pt-3.5">
        <span className="text-[15px] font-bold">合計</span>
        <span className="num text-[32px] font-bold tracking-[-.01em]">
          {yen(sumCashCounts(counts))}
        </span>
      </div>
    </div>
  );
}
