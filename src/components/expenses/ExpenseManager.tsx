"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense, deleteExpense, type ExpenseDTO } from "@/app/(app)/expenses/actions";
import { yen } from "@/lib/money";
import { todayJST } from "@/lib/date";
import { Trash2, Plus } from "lucide-react";

export function ExpenseManager({
  initialExpenses,
  readOnly = false,
}: {
  initialExpenses: ExpenseDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [spentOn, setSpentOn] = useState(todayJST());
  const [pending, setPending] = useState(false);

  function guardReadOnly(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、この操作はできません。");
      return true;
    }
    return false;
  }

  async function handleCreate() {
    if (guardReadOnly()) return;
    setPending(true);
    try {
      await createExpense({ name, amount: Number(amount || 0), memo: memo || undefined, spentOn });
      setName("");
      setAmount("");
      setMemo("");
      toast.success("経費を記録しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (guardReadOnly()) return;
    if (!confirm("この経費を削除しますか？")) return;
    try {
      await deleteExpense(id);
      toast.success("削除しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-bold">経費を記録</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-muted">
            日付
            <input
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              type="date"
              className="mt-1 block rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            品名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 紙コップ"
              className="mt-1 block w-36 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            金額
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              className="mt-1 block w-28 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            メモ(任意)
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="mt-1 block w-40 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="flex items-center gap-1 rounded bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} />
            経費を追加
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted">
              <th className="px-4 py-2.5">日付</th>
              <th className="px-4 py-2.5">品名</th>
              <th className="px-4 py-2.5">金額</th>
              <th className="px-4 py-2.5">メモ</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {initialExpenses.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-ink-muted">{e.spentOn}</td>
                <td className="px-4 py-2.5 font-medium">{e.name}</td>
                <td className="num px-4 py-2.5">{yen(e.amount)}</td>
                <td className="px-4 py-2.5 text-ink-muted">{e.memo}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="rounded p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
                    aria-label="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {initialExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">
                  まだ経費がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
