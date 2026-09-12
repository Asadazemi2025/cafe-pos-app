import Link from "next/link";

// テストモード中はレジ画面でも必ず目に入るように、上部に帯を出す。
// 本番のつもりで練習データを積み上げてしまう事故を防ぐ。
export function TestModeBanner() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-alert-border bg-alert-weak px-[22px] py-2 text-[13px] text-alert-deep">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-alert px-2 py-0.5 text-[11px] font-bold text-white">
          テスト
        </span>
        <span className="font-bold">練習用のモードです。</span>
        <span className="hidden sm:inline">
          ここでの会計は本番の売上に出ません。カード決済のお金も動きません。
        </span>
      </div>
      <Link href="/select-event" className="shrink-0 whitespace-nowrap underline hover:opacity-80">
        本番に切り替える
      </Link>
    </div>
  );
}
