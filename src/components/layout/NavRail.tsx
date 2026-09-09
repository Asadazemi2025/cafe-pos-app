"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/logout/actions";

// アイコンは既存ライブラリではなく、デザイン通りの幾何形(border 2.5px相当)で作る
const NAV = [
  { href: "/register", label: "レジ", icon: "yen" },
  { href: "/stock", label: "在庫", icon: "square" },
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
    <nav className="flex w-24 shrink-0 flex-col gap-1 overflow-y-auto bg-dark px-2.5 py-[18px]">
      <div className="h-1.5" />
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`press press-nav flex shrink-0 flex-col items-center gap-[5px] rounded-lg px-1 py-2.5 text-[11px] font-bold transition-colors ${
              active ? "bg-accent text-white" : "text-[#959b90] hover:bg-dark-hover"
            }`}
          >
            <NavIcon kind={item.icon} />
            {item.label}
          </Link>
        );
      })}

      <form action={logout} className="mt-auto flex flex-col items-center gap-1.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-dark-3 text-xs font-bold text-[#ced3c8]">
          店
        </div>
        <button
          type="submit"
          className="press press-chip rounded-lg px-2 py-1 text-[10px] font-bold text-[#8b9187] hover:bg-dark-hover hover:text-white"
        >
          ログアウト
        </button>
      </form>
    </nav>
  );
}
