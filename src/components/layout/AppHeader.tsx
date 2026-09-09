"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { yen } from "@/lib/money";
import type { CurrentEvent } from "@/lib/event";

const TITLES: Record<string, string> = {
  "/register": "レジ",
  "/stock": "在庫管理",
  "/expenses": "経費",
  "/analytics": "損益と分析",
  "/kanri": "管理会計",
  "/surveys": "アンケート",
  "/review": "振り返り",
};

export function AppHeader({
  event,
  daySales,
  badge,
  badgeReached,
}: {
  event: CurrentEvent;
  daySales: number;
  badge: string;
  badgeReached: boolean;
}) {
  const pathname = usePathname();
  const title =
    Object.entries(TITLES).find(([href]) => pathname.startsWith(href))?.[1] ?? "レジ";
  const day = event.dayList[event.dayIndex];

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-[22px]">
      <div className="text-[17px] font-bold tracking-[.01em]">{title}</div>
      <div className="h-[22px] w-px bg-border" />
      <div>
        <div className="text-[13px] font-bold">{event.name}</div>
        <div className="text-[11px] text-ink-muted">{event.rangeLabel}</div>
      </div>
      <Link
        href="/select-event"
        className="press press-chip flex items-center gap-[5px] rounded-[9px] border border-border bg-surface px-3 py-[7px] text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
      >
        <span className="text-sm leading-none">‹</span>イベント一覧
      </Link>

      <div className="ml-auto flex items-center gap-[18px]">
        <div className="text-right">
          <div className="num text-[10px] tracking-[.1em] text-ink-muted">
            {day ? `${day.label} ／ ${day.dateLabel}` : ""}
          </div>
          <div className="num text-[17px] font-bold tracking-[-.01em]">{yen(daySales)}</div>
        </div>
        <div
          className={`rounded-full px-3 py-[7px] text-xs font-bold ${
            badgeReached ? "bg-accent-weak-2 text-accent-deep" : "bg-alert-weak text-alert-deep"
          }`}
        >
          {badge}
        </div>
      </div>
    </header>
  );
}
