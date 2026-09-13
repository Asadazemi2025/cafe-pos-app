"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { switchTestMode } from "@/app/select-event/actions";

// テストモードの入り切り。以前は画面の上に帯を出していたが、
// レジの表示領域を毎回ぶんどるので、iPhoneの設定画面のようなスイッチにした。
// 帯の役目(いま練習用かどうかが必ず目に入る)は、入っている間スイッチを
// 警告色にして「テスト中」と出すことで残している。
export function TestModeSwitch({
  testMode,
  readOnly = false,
}: {
  testMode: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    if (readOnly) {
      toast.error("閲覧モードのため、切り替えできません。");
      return;
    }

    const next = !testMode;

    // 本番へ戻すときだけ確認する。こちらは実際にお金が動く向きのため。
    if (!next) {
      const ok = confirm(
        "本番モードに切り替えます。\n\n" +
          "・これ以降の会計は本物の売上として記録されます\n" +
          "・カード決済は実際にお金が動きます\n" +
          "・練習でつけたデータは画面から見えなくなります(消えてはいません)\n\n" +
          "よろしいですか？",
      );
      if (!ok) return;
    }

    setPending(true);
    try {
      await switchTestMode(next);
      toast.success(
        next
          ? "テストモードにしました。ここでの会計は本番の売上に出ません。"
          : "本番モードにしました。これ以降の会計は本物の売上になります。",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={testMode}
      onClick={toggle}
      disabled={pending}
      title={
        testMode
          ? "練習用のモードです。会計は本番の売上に出ず、カード決済のお金も動きません。押すと本番に切り替わります。"
          : "本番モードです。押すと練習用のテストモードに切り替わります。"
      }
      className="flex shrink-0 items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`text-[11px] font-bold ${testMode ? "text-alert-deep" : "text-ink-muted"}`}
      >
        {testMode ? "テスト中" : "テスト"}
      </span>
      <span
        aria-hidden
        className={`relative block h-[26px] w-[44px] rounded-full transition-colors duration-200 ${
          testMode ? "bg-alert" : "bg-border-strong"
        }`}
      >
        <span
          className={`absolute left-[2px] top-[2px] block h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform duration-200 ${
            testMode ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
