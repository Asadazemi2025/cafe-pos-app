"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(app)/logout/actions";
import {
  LayoutDashboard,
  ShoppingCart,
  Wheat,
  Coffee,
  Calculator,
  Receipt,
  BarChart3,
  TrendingUp,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/register", label: "レジ", icon: ShoppingCart },
  { href: "/breakeven", label: "損益分岐点", icon: TrendingUp },
  { href: "/ingredients", label: "材料・仕入れ", icon: Wheat },
  { href: "/menu-items", label: "メニュー・レシピ", icon: Coffee },
  { href: "/daily", label: "レジ初め・締め", icon: Calculator },
  { href: "/expenses", label: "経費", icon: Receipt },
  { href: "/analytics", label: "分析", icon: BarChart3 },
];

export function Sidebar({
  currentEvent,
}: {
  currentEvent: { id: string; name: string; date: string } | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-ink">
      <div className="px-2.5 pb-4">
        <p className="text-sm font-bold tracking-tight">つむぐカフェ</p>
      </div>

      <Link
        href="/select-event"
        className="mb-4 block rounded-lg bg-sidebar-hover px-2.5 py-2 transition-colors hover:opacity-90"
      >
        <span className="block text-[10px] text-sidebar-ink-muted">選択中のイベント</span>
        <span className="block truncate text-xs font-bold">
          {currentEvent ? currentEvent.name : "未選択"}
        </span>
        {currentEvent && (
          <span className="block text-[10px] text-sidebar-ink-muted">{currentEvent.date}</span>
        )}
        <span className="mt-1 block text-[10px] text-sidebar-ink-muted underline">
          イベントを切り替え
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-hover text-sidebar-ink"
                  : "text-sidebar-ink-muted hover:bg-sidebar-hover hover:text-sidebar-ink"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-ink-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-ink"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </form>
    </aside>
  );
}
