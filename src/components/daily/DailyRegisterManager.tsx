"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openDay, closeDay, resetDay, type DailyRegisterDTO } from "@/app/(app)/daily/actions";
import { DENOMINATIONS, sumCashCounts, type CashCounts } from "@/lib/denominations";
import { yen } from "@/lib/money";

export function DailyRegisterManager({
  day,
  initialRegister,
  currentExpectedCash,
  readOnly = false,
}: {
  day: string;
  initialRegister: DailyRegisterDTO | null;
  currentExpectedCash: number | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<CashCounts>({});
  const [closingCash, setClosingCash] = useState("");
  const [pending, setPending] = useState(false);
  const [closeResult, setCloseResult] = useState<{ diff: number } | null>(null);

  function guardReadOnly(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、この操作はできません。");
      return true;
    }
    return false;
  }

  async function handleOpen() {
    if (guardReadOnly()) return;
    setPending(true);
    try {
      await openDay(day, counts);
      toast.success("レジ初めを記録しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleClose() {
    if (guardReadOnly()) return;
    setPending(true);
    try {
      const result = await closeDay(day, Number(closingCash || 0));
      setCloseResult(result);
      toast.success("レジ締めを記録しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleReset() {
    if (guardReadOnly()) return;
    if (!confirm("この日のレジ初め・締めの記録をやり直しますか？")) return;
    try {
      await resetDay(day);
      setCloseResult(null);
      toast.success("リセットしました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "リセットに失敗しました。");
    }
  }

  if (!initialRegister?.openedAt) {
    return (
      <div className="max-w-lg rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="mb-1 text-sm font-bold">レジ初め({day})</p>
        <p className="mb-3 text-xs text-ink-muted">
          開始時の釣り銭を、金種ごとの枚数で入力してください。
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DENOMINATIONS.map((denom) => (
            <label key={denom} className="text-xs text-ink-muted">
              ¥{denom.toLocaleString("ja-JP")}
              <input
                type="number"
                min={0}
                value={counts[denom] ?? ""}
                onChange={(e) =>
                  setCounts((cur) => ({ ...cur, [denom]: Number(e.target.value || 0) }))
                }
                className="mt-1 block w-full rounded border border-border px-2 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold">合計</span>
          <span className="num font-bold">{yen(sumCashCounts(counts))}</span>
        </div>
        <button
          onClick={handleOpen}
          disabled={pending}
          className="mt-3 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-50"
        >
          レジ初め
        </button>
      </div>
    );
  }

  if (initialRegister.closedAt) {
    const diff = (initialRegister.closingCash ?? 0) - (initialRegister.expectedCash ?? 0);
    return (
      <div className="max-w-lg space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="text-sm font-bold">レジ締め完了({day})</p>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-ink-muted">開始時の釣り銭</span>
          <span className="num text-right">{yen(initialRegister.openingCash ?? 0)}</span>
          <span className="text-ink-muted">期待される現金額</span>
          <span className="num text-right">{yen(initialRegister.expectedCash ?? 0)}</span>
          <span className="text-ink-muted">実査した現金額</span>
          <span className="num text-right">{yen(initialRegister.closingCash ?? 0)}</span>
          <span className="font-bold">現金過不足</span>
          <span className={`num text-right font-bold ${diff !== 0 ? "text-danger" : "text-success"}`}>
            {diff === 0 ? "一致" : yen(diff)}
          </span>
        </div>
        <button
          onClick={handleReset}
          className="w-full rounded-full border border-border py-2 text-xs text-ink-muted hover:bg-surface-hover"
        >
          やり直す
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="text-sm font-bold">レジ締め({day})</p>
      <div className="grid grid-cols-2 gap-y-1.5 text-sm">
        <span className="text-ink-muted">開始時の釣り銭</span>
        <span className="num text-right">{yen(initialRegister.openingCash ?? 0)}</span>
        <span className="text-ink-muted">現時点の期待現金額</span>
        <span className="num text-right">{currentExpectedCash != null ? yen(currentExpectedCash) : "—"}</span>
      </div>

      <label className="block text-xs text-ink-muted">
        実査した現金額
        <input
          value={closingCash}
          onChange={(e) => setClosingCash(e.target.value)}
          type="number"
          className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
        />
      </label>

      <button
        onClick={handleClose}
        disabled={pending}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-50"
      >
        レジ締め
      </button>

      {closeResult && (
        <p className={`text-sm font-bold ${closeResult.diff !== 0 ? "text-danger" : "text-success"}`}>
          {closeResult.diff === 0 ? "現金は一致しました。" : `現金過不足: ${yen(closeResult.diff)}`}
        </p>
      )}
    </div>
  );
}
