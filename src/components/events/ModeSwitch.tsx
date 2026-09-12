"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { switchTestMode, type AppModeDTO } from "@/app/select-event/actions";

// テストモードと本番モードの切り替え。
// 練習でつけた売上や経費が本番の数字に混ざらないよう、記録先ごと分ける。
export function ModeSwitch({ mode, readOnly = false }: { mode: AppModeDTO; readOnly?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(testMode: boolean) {
    if (readOnly) {
      toast.error("閲覧モードのため、切り替えできません。");
      return;
    }
    if (testMode === mode.testMode) return;

    if (!testMode) {
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
      await switchTestMode(testMode);
      toast.success(testMode ? "テストモードにしました。" : "本番モードにしました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border px-[18px] py-3.5 ${
        mode.testMode ? "border-alert-border bg-alert-weak" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold">
            {mode.testMode ? "いまはテストモードです" : "いまは本番モードです"}
          </div>
          <div className={`text-[11px] ${mode.testMode ? "text-alert-deep" : "text-ink-muted"}`}>
            {mode.testMode
              ? "売上・経費・レジ・アンケートは練習用として記録され、本番の数字には出ません。"
              : "会計は本物の売上として記録されます。"}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 gap-1.5">
          <button
            onClick={() => change(false)}
            disabled={pending}
            className={`press press-chip rounded-[9px] border px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${
              !mode.testMode
                ? "border-accent bg-accent-weak text-accent-deep"
                : "border-border bg-surface text-ink-muted"
            }`}
          >
            本番
          </button>
          <button
            onClick={() => change(true)}
            disabled={pending}
            className={`press press-chip rounded-[9px] border px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${
              mode.testMode
                ? "border-alert bg-surface text-alert-deep"
                : "border-border bg-surface text-ink-muted"
            }`}
          >
            テスト
          </button>
        </div>
      </div>

      <div className="mt-2 border-t border-border pt-2 text-[11px] text-ink-muted">
        カード決済:{" "}
        {mode.testMode ? (
          <b className="text-alert-deep">テスト決済（お金は動きません）</b>
        ) : mode.stripeLive ? (
          <b className="text-accent-deep">本番決済（実際にお金が動きます）</b>
        ) : (
          <>
            <b className="text-alert-deep">テスト用のキーのままです</b>
            {" — "}
            Vercelの環境変数に <code>STRIPE_SECRET_KEY_LIVE</code> を入れると本番決済になります
          </>
        )}
      </div>
    </div>
  );
}
