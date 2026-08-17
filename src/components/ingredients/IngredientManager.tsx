"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createIngredient,
  createIngredientPurchase,
  adjustIngredientStock,
  deleteIngredient,
  type IngredientDTO,
} from "@/app/(app)/ingredients/actions";
import { Modal } from "@/components/ui/Modal";
import { Plus, Trash2 } from "lucide-react";
import type { StockAdjustmentReason } from "@prisma/client";

const REASON_LABEL: Record<StockAdjustmentReason, string> = {
  MISTAKE: "操作ミス・数え間違い",
  PURCHASE_DECREASE: "仕入数の訂正",
  OTHER: "その他",
};

export function IngredientManager({
  initialIngredients,
  readOnly = false,
}: {
  initialIngredients: IngredientDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [newQty, setNewQty] = useState("");
  const [newCost, setNewCost] = useState("");
  const [creating, setCreating] = useState(false);

  const [purchaseTarget, setPurchaseTarget] = useState<IngredientDTO | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<IngredientDTO | null>(null);

  function guardReadOnly(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、この操作はできません。");
      return true;
    }
    return false;
  }

  async function handleCreate() {
    if (guardReadOnly()) return;
    if (!newName.trim() || !newUnit.trim()) {
      toast.error("材料名と単位を入力してください。");
      return;
    }
    setCreating(true);
    try {
      await createIngredient({
        name: newName,
        unit: newUnit,
        initialQuantity: newQty ? Number(newQty) : undefined,
        initialUnitCost: newCost ? Number(newCost) : undefined,
      });
      setNewName("");
      setNewQty("");
      setNewCost("");
      toast.success("材料を登録しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました。");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (guardReadOnly()) return;
    if (!confirm("この材料を削除しますか？")) return;
    try {
      await deleteIngredient(id);
      toast.success("削除しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-bold">材料を新規登録</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-muted">
            材料名
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: エスプレッソ豆"
              className="mt-1 block w-40 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            単位
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="g / ml / 個"
              className="mt-1 block w-20 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            初期在庫(任意)
            <input
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              type="number"
              className="mt-1 block w-28 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-ink-muted">
            仕入単価(任意)
            <input
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              type="number"
              className="mt-1 block w-28 rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1 rounded bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} />
            登録する
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted">
              <th className="px-4 py-2.5">材料名</th>
              <th className="px-4 py-2.5">在庫</th>
              <th className="px-4 py-2.5">単価</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => {
              const low = ing.lowStockThreshold != null && ing.stock <= ing.lowStockThreshold;
              return (
                <tr key={ing.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{ing.name}</td>
                  <td className={`num px-4 py-2.5 ${low ? "text-danger font-bold" : ""}`}>
                    {ing.stock.toLocaleString("ja-JP")} {ing.unit}
                  </td>
                  <td className="num px-4 py-2.5 text-ink-muted">
                    ¥{ing.costPerUnit.toLocaleString("ja-JP")} / {ing.unit}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => (guardReadOnly() ? null : setPurchaseTarget(ing))}
                        className="rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-hover"
                      >
                        仕入れを記録
                      </button>
                      <button
                        onClick={() => (guardReadOnly() ? null : setAdjustTarget(ing))}
                        className="rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-hover"
                      >
                        在庫を修正
                      </button>
                      <button
                        onClick={() => handleDelete(ing.id)}
                        className="rounded p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {ingredients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-muted">
                  まだ材料が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {purchaseTarget && (
        <PurchaseModal
          ingredient={purchaseTarget}
          onClose={() => setPurchaseTarget(null)}
          onDone={() => router.refresh()}
        />
      )}
      {adjustTarget && (
        <AdjustModal
          ingredient={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function PurchaseModal({
  ingredient,
  onClose,
  onDone,
}: {
  ingredient: IngredientDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(String(ingredient.costPerUnit || ""));
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!quantity || Number(quantity) <= 0) {
      toast.error("数量を入力してください。");
      return;
    }
    setPending(true);
    try {
      await createIngredientPurchase({
        ingredientId: ingredient.id,
        quantity: Number(quantity),
        unitCost: Number(unitCost || 0),
        memo: memo || undefined,
      });
      toast.success("仕入れを記録しました。");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`${ingredient.name} の仕入れを記録`}>
      <div className="space-y-3">
        <label className="block text-xs text-ink-muted">
          今回仕入れる数量({ingredient.unit})
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            autoFocus
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          仕入単価(1{ingredient.unit}あたり)
          <input
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            type="number"
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          メモ(任意)
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={submit}
          disabled={pending}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          記録する
        </button>
      </div>
    </Modal>
  );
}

function AdjustModal({
  ingredient,
  onClose,
  onDone,
}: {
  ingredient: IngredientDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nextStock, setNextStock] = useState(String(ingredient.stock));
  const [reason, setReason] = useState<StockAdjustmentReason>("MISTAKE");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await adjustIngredientStock({
        ingredientId: ingredient.id,
        nextStock: Number(nextStock),
        reason,
        note: note || undefined,
      });
      toast.success("在庫を修正しました。");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "修正に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`${ingredient.name} の在庫を修正`}>
      <div className="space-y-3">
        <label className="block text-xs text-ink-muted">
          修正後の在庫数({ingredient.unit})
          <input
            value={nextStock}
            onChange={(e) => setNextStock(e.target.value)}
            type="number"
            autoFocus
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          理由
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          >
            {Object.entries(REASON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ink-muted">
          メモ(任意)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={submit}
          disabled={pending}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          確定する
        </button>
      </div>
    </Modal>
  );
}
