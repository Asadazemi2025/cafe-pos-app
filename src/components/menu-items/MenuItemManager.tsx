"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createMenuItem,
  updateMenuItem,
  saveRecipe,
  deleteMenuItem,
  getMenuItemRecipe,
  type MenuItemDTO,
  type IngredientOptionDTO,
} from "@/app/(app)/menu-items/actions";
import { Modal } from "@/components/ui/Modal";
import { Plus, Trash2, Pencil } from "lucide-react";
import { yen } from "@/lib/money";

type RecipeLine = { ingredientId: string; quantityPerUnit: string };

export function MenuItemManager({
  initialMenuItems,
  ingredientOptions,
  readOnly = false,
}: {
  initialMenuItems: MenuItemDTO[];
  ingredientOptions: IngredientOptionDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MenuItemDTO | "new" | null>(null);

  function guardReadOnly(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、この操作はできません。");
      return true;
    }
    return false;
  }

  async function handleDelete(id: string) {
    if (guardReadOnly()) return;
    if (!confirm("このメニューを削除しますか？")) return;
    try {
      await deleteMenuItem(id);
      toast.success("削除しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => (guardReadOnly() ? null : setEditing("new"))}
          className="flex items-center gap-1 rounded bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={15} />
          メニューを新規登録
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-muted">
              <th className="px-4 py-2.5">メニュー名</th>
              <th className="px-4 py-2.5">原価</th>
              <th className="px-4 py-2.5">販売価格</th>
              <th className="px-4 py-2.5">粗利</th>
              <th className="px-4 py-2.5">レジ表示</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {initialMenuItems.map((m) => {
              const margin = m.salePrice - m.costPrice;
              const marginRate = m.salePrice > 0 ? (margin / m.salePrice) * 100 : 0;
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {m.name}
                    {m.category && (
                      <span className="ml-2 text-xs text-ink-muted">{m.category}</span>
                    )}
                  </td>
                  <td className="num px-4 py-2.5 text-ink-muted">{yen(m.costPrice)}</td>
                  <td className="num px-4 py-2.5">{yen(m.salePrice)}</td>
                  <td className="num px-4 py-2.5">
                    {yen(margin)}
                    <span className="ml-1.5 text-xs text-ink-muted">
                      ({marginRate.toFixed(0)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">
                    {m.showInRegister ? "表示中" : "非表示"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => (guardReadOnly() ? null : setEditing(m))}
                        className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-hover"
                      >
                        <Pencil size={12} />
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
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
            {initialMenuItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-muted">
                  まだメニューが登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <MenuItemEditor
          target={editing === "new" ? null : editing}
          ingredientOptions={ingredientOptions}
          onClose={() => setEditing(null)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function MenuItemEditor({
  target,
  ingredientOptions,
  onClose,
  onDone,
}: {
  target: MenuItemDTO | null;
  ingredientOptions: IngredientOptionDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [category, setCategory] = useState(target?.category ?? "");
  const [salePrice, setSalePrice] = useState(target ? String(target.salePrice) : "");
  const [showInRegister, setShowInRegister] = useState(target?.showInRegister ?? true);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(!!target);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!target) return;
    getMenuItemRecipe(target.id)
      .then((recipe) =>
        setLines(
          recipe.map((r) => ({
            ingredientId: r.ingredientId,
            quantityPerUnit: String(r.quantityPerUnit),
          })),
        ),
      )
      .finally(() => setLoadingRecipe(false));
    // targetは開いたときの初期値のみを使う(編集中に切り替わらない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines((cur) => [...cur, { ingredientId: "", quantityPerUnit: "" }]);
  }
  function updateLine(i: number, patch: Partial<RecipeLine>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((cur) => cur.filter((_, idx) => idx !== i));
  }

  const costPreview = lines.reduce((sum, l) => {
    const ing = ingredientOptions.find((o) => o.id === l.ingredientId);
    const qty = Number(l.quantityPerUnit);
    if (!ing || !qty) return sum;
    return sum + ing.costPerUnit * qty;
  }, 0);

  async function submit() {
    if (!name.trim()) {
      toast.error("メニュー名を入力してください。");
      return;
    }
    setPending(true);
    try {
      let id: string;
      if (target) {
        await updateMenuItem({
          id: target.id,
          name,
          category,
          salePrice: Number(salePrice || 0),
          showInRegister,
        });
        id = target.id;
      } else {
        id = await createMenuItem({
          name,
          category,
          salePrice: Number(salePrice || 0),
          showInRegister,
        });
      }

      await saveRecipe(
        id,
        lines
          .filter((l) => l.ingredientId && Number(l.quantityPerUnit) > 0)
          .map((l) => ({ ingredientId: l.ingredientId, quantityPerUnit: Number(l.quantityPerUnit) })),
      );

      toast.success("保存しました。");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={target ? "メニューを編集" : "メニューを新規登録"}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block text-xs text-ink-muted">
            メニュー名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            カテゴリ(任意)
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例: ドリンク"
              className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            販売価格
            <input
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              type="number"
              className="mt-1 block w-full rounded border border-border px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={showInRegister}
            onChange={(e) => setShowInRegister(e.target.checked)}
          />
          レジ画面に表示する
        </label>

        <div className="border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">レシピ(材料の配合)</p>
            <button
              onClick={addLine}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-surface-hover"
            >
              <Plus size={12} />
              材料を追加
            </button>
          </div>

          {loadingRecipe ? (
            <p className="text-xs text-ink-muted">読み込み中…</p>
          ) : (
            <div className="space-y-2">
              {lines.map((line, i) => {
                const ing = ingredientOptions.find((o) => o.id === line.ingredientId);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={line.ingredientId}
                      onChange={(e) => updateLine(i, { ingredientId: e.target.value })}
                      className="flex-1 rounded border border-border px-2 py-1.5 text-sm"
                    >
                      <option value="">材料を選択</option>
                      {ingredientOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={line.quantityPerUnit}
                      onChange={(e) => updateLine(i, { quantityPerUnit: e.target.value })}
                      type="number"
                      placeholder="消費量"
                      className="w-24 rounded border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="w-8 shrink-0 text-xs text-ink-muted">{ing?.unit ?? ""}</span>
                    <button
                      onClick={() => removeLine(i)}
                      className="rounded p-1 text-ink-muted hover:bg-danger/10 hover:text-danger"
                      aria-label="削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              {lines.length === 0 && (
                <p className="text-xs text-ink-muted">材料が登録されていません。</p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded bg-accent-weak px-3 py-2 text-sm font-bold text-accent">
            <span>この配合での原価</span>
            <span className="num">{yen(costPreview)}</span>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={pending || loadingRecipe}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          保存する
        </button>
      </div>
    </Modal>
  );
}
