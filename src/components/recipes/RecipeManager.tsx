"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveRecipe,
  updateSalePrice,
  type IngredientOptionDTO,
  type RecipeProductDTO,
} from "@/app/(app)/recipes/actions";
import { yen } from "@/lib/money";

const UNITS = ["g", "ml", "個", "枚", "本"];

type Row = {
  key: string;
  name: string;
  unit: string;
  /** 買ったときの値段(例: 300円) */
  purchasePrice: string;
  /** 買ったときの量(例: 100g) */
  purchaseQty: string;
  /** この商品1個に使う量(例: 10g) */
  quantity: string;
};

let rowSeq = 0;
const newRow = (): Row => ({
  key: `row-${rowSeq++}`,
  name: "",
  unit: "g",
  purchasePrice: "",
  purchaseQty: "",
  quantity: "",
});

export function RecipeManager({
  products,
  ingredients,
  readOnly = false,
}: {
  products: RecipeProductDTO[];
  ingredients: IngredientOptionDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);

  const product = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0],
    [products, selectedId],
  );

  // 商品を切り替えたら、その商品のレシピを編集欄に読み込む
  useEffect(() => {
    if (!product) return;
    setRows(
      product.lines.length > 0
        ? product.lines.map((l) => ({
            key: `line-${l.ingredientId}`,
            name: l.name,
            unit: l.unit,
            purchasePrice: String(l.purchasePrice),
            purchaseQty: String(l.purchaseQty),
            quantity: String(l.quantity),
          }))
        : [newRow()],
    );
    setPrice(String(product.salePrice));
  }, [product]);

  function guard(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return true;
    }
    return false;
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // 材料名を選ぶと、前に登録した「買った値段・買った量」をそのまま引いてくる
  function fillFromIngredient(key: string, name: string) {
    const found = ingredients.find((i) => i.name === name);
    if (found) {
      update(key, {
        name,
        unit: found.unit,
        purchasePrice: String(found.purchasePrice),
        purchaseQty: String(found.purchaseQty),
      });
    } else {
      update(key, { name });
    }
  }

  // 1単位あたりの値段 = 買った値段 ÷ 買った量
  const unitCostOf = (r: Row) => {
    const qty = Number(r.purchaseQty) || 0;
    return qty > 0 ? (Number(r.purchasePrice) || 0) / qty : 0;
  };
  const lineAmount = (r: Row) => (Number(r.quantity) || 0) * unitCostOf(r);
  const cost = rows.reduce((sum, r) => sum + lineAmount(r), 0);
  const salePrice = Number(price) || 0;
  const margin = salePrice - cost;
  const marginRate = salePrice > 0 ? margin / salePrice : 0;

  async function handleSave() {
    if (guard() || !product) return;
    setPending(true);
    try {
      await saveRecipe(
        product.id,
        rows.map((r) => ({
          name: r.name,
          unit: r.unit,
          quantity: Number(r.quantity) || 0,
          purchasePrice: Number(r.purchasePrice) || 0,
          purchaseQty: Number(r.purchaseQty) || 0,
        })),
      );
      if (salePrice !== product.salePrice) {
        await updateSalePrice(product.id, salePrice);
      }
      toast.success("レシピを保存しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  if (!product) {
    return (
      <div className="anim-fade-up p-4 md:p-[22px]">
        <p className="rounded-2xl border border-border bg-surface px-[18px] py-10 text-center text-sm text-ink-muted">
          まだ商品がありません。先に「在庫」の画面から商品を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="anim-fade-up flex h-full min-h-0 flex-col gap-3.5 p-4 md:p-[22px] lg:flex-row">
      {/* 商品の一覧 */}
      <div className="flex max-h-[240px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface lg:max-h-none lg:w-[280px]">
        <div className="border-b border-border bg-surface-alt px-4 py-3 text-[11px] font-bold text-ink-muted">
          商品 {products.length}件
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {products.map((p) => {
            const on = p.id === product.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`press press-row block w-full border-b border-border-row px-4 py-3 text-left last:border-b-0 ${
                  on ? "bg-accent-weak" : "hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm font-bold ${on ? "text-accent-deep" : ""}`}>
                    {p.name}
                  </span>
                  <span className="num text-[11px] text-ink-muted">{yen(p.salePrice)}</span>
                </div>
                <div className="num mt-0.5 text-[11px] text-ink-muted">
                  {p.lines.length === 0 ? (
                    <span className="text-alert-deep">レシピ未登録</span>
                  ) : (
                    <>
                      原価 {yen(p.cost)}／粗利率 {Math.round(p.marginRate * 100)}%
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* レシピの編集 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 md:px-[18px] md:py-3.5">
          <div>
            <div className="text-[17px] font-bold">{product.name}</div>
            <div className="text-[11px] text-ink-muted">
              {product.category ?? "区分なし"} ／ この商品1個ぶんの材料を書きます
            </div>
          </div>
          <label className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-ink-muted">売価</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min={0}
              className="num w-[100px] rounded-xl border border-border px-3 py-2 text-right text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 md:px-[18px]">
          <div className="grid min-w-[720px] grid-cols-[1.4fr_.85fr_.85fr_.6fr_.85fr_.9fr_36px] items-end gap-2 pb-2 text-[11px] font-bold text-ink-muted">
            <div>材料</div>
            <div className="text-right">買った値段</div>
            <div className="text-right">買った量</div>
            <div>単位</div>
            <div className="text-right">1個に使う量</div>
            <div className="text-right">この商品の原価</div>
            <div />
          </div>

          {rows.map((r) => (
            <div
              key={r.key}
              className="grid min-w-[720px] grid-cols-[1.4fr_.85fr_.85fr_.6fr_.85fr_.9fr_36px] items-center gap-2 border-t border-border-row py-2"
            >
              <input
                value={r.name}
                onChange={(e) => fillFromIngredient(r.key, e.target.value)}
                list="ingredient-names"
                placeholder="例: コーヒー豆"
                className="w-full rounded-[9px] border border-border px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-placeholder focus:border-accent"
              />
              <div className="flex items-center gap-1">
                <input
                  value={r.purchasePrice}
                  onChange={(e) => update(r.key, { purchasePrice: e.target.value })}
                  type="number"
                  min={0}
                  placeholder="300"
                  className="num w-full rounded-[9px] border border-border px-2 py-2 text-right text-[13px] outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-muted">円</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-ink-muted">で</span>
                <input
                  value={r.purchaseQty}
                  onChange={(e) => update(r.key, { purchaseQty: e.target.value })}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="100"
                  className="num w-full rounded-[9px] border border-border px-2 py-2 text-right text-[13px] outline-none focus:border-accent"
                />
              </div>
              <select
                value={r.unit}
                onChange={(e) => update(r.key, { unit: e.target.value })}
                className="w-full rounded-[9px] border border-border px-1.5 py-2 text-[13px] outline-none focus:border-accent"
              >
                {[...new Set([...UNITS, r.unit])].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  value={r.quantity}
                  onChange={(e) => update(r.key, { quantity: e.target.value })}
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="10"
                  className="num w-full rounded-[9px] border border-border px-2 py-2 text-right text-[13px] outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-muted">{r.unit}</span>
              </div>
              <div className="text-right">
                <div className="num text-sm font-bold">{yen(lineAmount(r))}</div>
                {Number(r.purchaseQty) > 0 && (
                  <div className="num text-[10px] text-ink-muted">
                    1{r.unit} {yen(unitCostOf(r))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="press press-chip rounded-[8px] py-1 text-xs text-ink-placeholder hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}

          <datalist id="ingredient-names">
            {ingredients.map((i) => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>

          <button
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="press press-cta mt-3 w-full rounded-xl border-[1.5px] border-dashed border-border-strong py-3 text-[13px] font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
          >
            ＋ 材料を追加
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            買ったときの値段と量をそのまま入れてください。
            「コーヒー豆を300円で100g買った」なら 300円 で 100 g、1杯に10g使うなら「1個に使う量」に 10。
            1gあたり3円なので原価は30円、と自動で計算します。
            買った値段や量を直すと、同じ材料を使っている他の商品の原価にも反映されます。
            登録した材料は在庫としても管理され、売れたぶんだけ自動で減ります。
          </p>
        </div>

        {/* 原価のまとめ */}
        <div className="border-t border-border bg-surface-alt px-[18px] py-3.5">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <Summary label="原価" value={yen(cost)} />
            <Summary label="売価" value={yen(salePrice)} />
            <Summary label="粗利" value={yen(margin)} accent={margin >= 0} />
            <Summary label="粗利率" value={`${Math.round(marginRate * 100)}%`} accent={margin >= 0} />
            <button
              onClick={handleSave}
              disabled={pending}
              className="press press-cta ml-auto rounded-[11px] bg-accent px-6 py-[13px] text-[13px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "レシピを保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold text-ink-muted">{label}</div>
      <div
        className={`num text-[22px] font-bold tracking-[-.01em] ${
          accent ? "text-accent-deep" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
