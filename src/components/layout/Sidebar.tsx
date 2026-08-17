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
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/register", label: "レジ", icon: ShoppingCart },
  { href: "/ingredients", label: "材料・仕入れ", icon: Wheat },
  { href: "/menu-items", label: "メニュー・レシピ", icon: Coffee },
  { href: "/daily", label: "レジ初め・締め", icon: Calculator },
  { href: "/expenses", label: "経費", icon: Receipt },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-ink">
      <div className="px-2.5 pb-5">
        <p className="text-sm font-bold tracking-tight">カフェPOS</p>
      </div>

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
