"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { selectDay } from "@/app/select-event/actions";
import type { EventDay } from "@/lib/event";

// 営業日バー。選んだ日で売上・レジ・分析・振り返りがすべて切り替わる。
export function DayBar({
  days,
  dayIndex,
  registerActive,
}: {
  days: EventDay[];
  dayIndex: number;
  registerActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSelect(index: number) {
    if (index === dayIndex) return;
    setPending(true);
    try {
      await selectDay(index);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[46px] shrink-0 items-center gap-[7px] overflow-x-auto border-b border-border bg-surface-bar px-4 md:px-[22px]">
      <div className="pr-1 text-[11px] font-bold text-ink-muted">営業日</div>
      {days.map((d) => {
        const active = d.index === dayIndex;
        return (
          <button
            key={d.index}
            onClick={() => handleSelect(d.index)}
            disabled={pending}
            className={`press press-chip flex items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] py-1.5 text-xs font-bold transition-colors ${
              active
                ? "border-dark bg-dark text-white"
                : "border-border bg-surface text-ink-muted hover:border-border-strong"
            }`}
          >
            {d.label}
            <span className="font-normal opacity-75">{d.dateLabel}</span>
          </button>
        );
      })}
      {registerActive && (
        <a
          href="/register?close=1"
          className="press press-chip ml-auto whitespace-nowrap rounded-full border border-border bg-surface px-[14px] py-1.5 text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
        >
          レジ締め
        </a>
      )}
    </div>
  );
}
