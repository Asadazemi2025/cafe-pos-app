"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/logout/actions";

// アイコンは既存ライブラリではなく、デザイン通りの幾何形(border 2.5px相当)で作る
const NAV = [
  { href: "/register", label: "レジ", icon: "yen" },
  { href: "/stock", label: "在庫", icon: "square" },
  { href: "/recipes", label: "レシピ", icon: "list" },
  { href: "/expenses", label: "経費", icon: "circle" },
  { href: "/analytics", label: "分析", icon: "bars" },
  { href: "/kanri", label: "管理会計", icon: "target" },
  { href: "/surveys", label: "アンケート", icon: "chat" },
  { href: "/review", label: "振り返り", icon: "blob" },
] as const;

function NavIcon({ kind }: { kind: (typeof NAV)[number]["icon"] }) {
  if (kind === "yen") {
    return (
      <div className="num text-[19px] leading-none">¥</div>
    );
  }
  if (kind === "bars") {
    return (
      <div className="flex h-[19px] items-end gap-[2.5px]">
        <div className="h-2 w-1 rounded-[1px] bg-current" />
        <div className="h-[15px] w-1 rounded-[1px] bg-current" />
        <div className="h-[19px] w-1 rounded-[1px] bg-current" />
      </div>
    );
  }
  if (kind === "list") {
    return (
      <div className="flex h-[19px] w-[19px] flex-col justify-between py-[2px]">
        <div className="h-[2.5px] w-full rounded-full bg-current" />
        <div className="h-[2.5px] w-full rounded-full bg-current" />
        <div className="h-[2.5px] w-3/5 rounded-full bg-current" />
      </div>
    );
  }
  if (kind === "target") {
    return (
      <div className="flex h-[19px] w-[19px] items-center justify-center rounded-full border-[2.5px] border-current">
        <div className="h-[5px] w-[5px] rounded-full bg-current" />
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="h-[19px] w-[19px] rounded-[5px] rounded-bl-[1px] border-[2.5px] border-current" />
    );
  }
  const radius =
    kind === "square" ? "rounded-[4px]" : kind === "circle" ? "rounded-full" : "rounded-[50%_50%_50%_4px]";
  return <div className={`h-[19px] w-[19px] border-[2.5px] border-current ${radius}`} />;
}

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex w-full shrink-0 flex-row gap-1 overflow-x-auto border-t border-dark-hover bg-dark px-2 py-1.5 md:static md:h-full md:w-24 md:flex-col md:overflow-y-auto md:border-t-0 md:px-2.5 md:py-[18px]">
      <div className="hidden h-1.5 md:block" />
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`press press-nav flex shrink-0 flex-col items-center gap-[5px] rounded-lg px-3 py-2 text-[10px] font-bold transition-colors md:px-1 md:py-2.5 md:text-[11px] ${
              active ? "bg-accent text-white" : "text-[#959b90] hover:bg-dark-hover"
            }`}
          >
            <NavIcon kind={item.icon} />
            {item.label}
          </Link>
        );
      })}

      <form action={logout} className="flex shrink-0 flex-col items-center justify-center gap-1.5 md:mt-auto">
        <div className="hidden h-[30px] w-[30px] items-center justify-center rounded-full bg-dark-3 text-xs font-bold text-[#ced3c8] md:flex">
          店
        </div>
        <button
          type="submit"
          className="press press-chip whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold text-[#8b9187] hover:bg-dark-hover hover:text-white md:px-2 md:py-1"
        >
          ログアウト
        </button>
      </form>
    </nav>
  );
}
