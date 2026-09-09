"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProduct } from "@/app/(app)/stock/actions";
import { yen } from "@/lib/money";

const CATEGORIES = ["ドリンク", "フード", "その他"];

// 商品登録モーダル(README §8)。幅560px、区分は3ボタン、数値は横並び。
// 原価だけは材料とレシピから自動計算するため、ここでは入力しない。
export function ProductFormModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [salePrice, setSalePrice] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [par, setPar] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const price = Number(salePrice) || 0;

  function reset() {
    setName("");
    setCategory(CATEGORIES[0]);
    setSalePrice("");
    setInitialStock("0");
    setPar("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("商品名を入力してください。");
      return;
    }
    if (price <= 0) {
      toast.error("売価を入力してください。");
      return;
    }
    setPending(true);
    try {
      await createProduct({
        name,
        category,
        salePrice: price,
        initialStock: Number(initialStock) || 0,
        par: Number(par) || 0,
      });
      toast.success("商品を登録しました。");
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="anim-pop max-h-[calc(100vh-32px)] w-full max-w-[560px] overflow-y-auto rounded-4xl bg-surface px-5 pb-7 pt-[26px] shadow-modal sm:px-8 sm:pt-[30px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[19px] font-bold">商品を登録</h2>
            <p className="mt-1 text-xs text-ink-muted">
              レジと在庫に並ぶ商品を追加します。原価は登録後にレシピを設定すると自動で計算されます。
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="press press-chip -mr-1 rounded-lg px-2 py-1 text-lg text-ink-placeholder hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="商品名">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="例: 自家焙煎ドリップ"
              className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
            />
          </Field>

          <Field label="区分">
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`press press-chip flex-1 rounded-xl border py-[11px] text-[13px] font-bold ${
                    category === c
                      ? "border-accent bg-accent-weak text-accent-deep"
                      : "border-border text-ink-muted hover:border-border-strong"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="売価">
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                type="number"
                min={0}
                className="num w-full rounded-xl border border-border px-3 py-[13px] text-[15px] outline-none focus:border-accent"
              />
            </Field>
            <Field label="原価">
              <div className="num flex h-[49px] items-center rounded-xl border border-dashed border-border bg-surface-alt px-3 text-[13px] text-ink-muted">
                レシピ
              </div>
            </Field>
            <Field label="初期在庫">
              <input
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                type="number"
                min={0}
                className="num w-full rounded-xl border border-border px-3 py-[13px] text-[15px] outline-none focus:border-accent"
              />
            </Field>
            <Field label="基準数">
              <input
                value={par}
                onChange={(e) => setPar(e.target.value)}
                type="number"
                min={0}
                placeholder="自動"
                className="num w-full rounded-xl border border-border px-3 py-[13px] text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
              />
            </Field>
          </div>

          <div className="rounded-xl bg-accent-weak-2 px-4 py-3 text-[13px] text-accent-deep">
            売価 {yen(price)}。原価は材料とレシピから自動で計算します。
            登録したあと「レシピ・原価を編集」から材料を割り当てると、1個あたりの粗利と損益分岐点に反映されます。
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={pending}
          className="press press-cta mt-5 w-full rounded-lg bg-accent py-[16px] text-base font-bold text-white disabled:opacity-50"
        >
          {pending ? "登録中…" : "登録する"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
