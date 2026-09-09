"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addStock,
  decrementStock,
  deleteProduct,
  updatePar,
  type StockRow,
  type StockSummary,
} from "@/app/(app)/stock/actions";
import { ProductFormModal } from "@/components/stock/ProductFormModal";
import { yen } from "@/lib/money";

const STATE = {
  ok: { label: "十分", cls: "bg-accent-weak-2 text-accent-deep" },
  low: { label: "要追加", cls: "bg-alert-weak text-alert-deep" },
  out: { label: "売切", cls: "bg-danger-weak text-danger" },
} as const;

// 残数/基準の比率で色を変える(README): 0.5以上=緑、0.25超=山吹、それ以下=赤
function barColor(ratio: number): string {
  if (ratio >= 0.5) return "rgb(var(--accent))";
  if (ratio > 0.25) return "rgb(var(--warning))";
  return "rgb(var(--danger))";
}

export function StockManager({
  rows,
  summary,
  readOnly = false,
}: {
  rows: StockRow[];
  summary: StockSummary;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  function guard(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return true;
    }
    return false;
  }

  async function run(key: string, fn: () => Promise<void>, done?: string) {
    if (guard()) return;
    setPending(key);
    try {
      await fn();
      if (done) toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました。");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="anim-fade-up p-4 md:p-[22px]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3.5">
        <SummaryCard
          label="在庫金額(原価)"
          value={yen(summary.stockValue)}
          note="材料＋仕込み済みの合計"
        />
        <SummaryCard
          label="この日の出庫"
          value={`${summary.soldUnits} 点`}
          note={`原価 ${yen(summary.soldCost)}`}
        />
        <SummaryCard
          label="要追加"
          value={`${summary.lowCount} 品`}
          note={summary.lowCount > 0 ? "残りが少ない商品があります" : "すべて十分です"}
          alert={summary.lowCount > 0}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 md:gap-3">
        <h2 className="text-[17px] font-bold">商品マスタ</h2>
        <span className="num text-xs text-ink-muted">{rows.length} 品目</span>
        <Link
          href="/recipes"
          className="press press-chip rounded-[9px] border border-border px-3 py-[7px] text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
        >
          レシピと原価
        </Link>
        <Link
          href="/ingredients"
          className="press press-chip rounded-[9px] border border-border px-3 py-[7px] text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
        >
          材料と仕入れ
        </Link>
        <button
          onClick={() => {
            if (!guard()) setFormOpen(true);
          }}
          className="press press-cta ml-auto shrink-0 rounded-[11px] bg-accent px-[18px] py-[11px] text-[13px] font-bold text-white"
        >
          ＋ 商品を登録
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
        <div className="grid min-w-[760px] grid-cols-[1.6fr_.7fr_1.5fr_.8fr_200px] items-center gap-3 border-b border-border bg-surface-alt px-[18px] py-3 text-[11px] font-bold text-ink-muted">
          <div>商品名</div>
          <div>区分</div>
          <div>残数 / 基準</div>
          <div>状態</div>
          <div className="text-right">操作</div>
        </div>

        {rows.map((row) => {
          const ratio = row.stock === null ? 1 : Math.min(1, row.stock / Math.max(1, row.par));
          const state = STATE[row.state];
          return (
            <div
              key={row.id}
              className="grid min-w-[760px] grid-cols-[1.6fr_.7fr_1.5fr_.8fr_200px] items-center gap-3 border-b border-border-row px-[18px] py-[13px] last:border-b-0"
            >
              <div>
                <div className="text-sm font-bold">{row.name}</div>
                <div className="num text-[11px] text-ink-muted">
                  売価 {yen(row.salePrice)} ／ 原価 {yen(row.costPrice)}
                </div>
              </div>

              <div className="text-xs text-ink-muted">{row.category ?? "—"}</div>

              <div className="flex items-center gap-2.5">
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${ratio * 100}%`, background: barColor(ratio) }}
                  />
                </div>
                {row.stock === null ? (
                  <span className="whitespace-nowrap text-[11px] text-ink-muted">材料しだい</span>
                ) : (
                  <span className="num whitespace-nowrap text-xs font-bold">
                    {row.stock} / {row.par}
                  </span>
                )}
                <input
                  defaultValue={row.par}
                  type="number"
                  min={0}
                  title="基準数"
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (next === row.par || !Number.isFinite(next)) return;
                    void run(`par-${row.id}`, () => updatePar(row.id, next));
                  }}
                  className="num w-[52px] rounded-[8px] border border-border px-1.5 py-1 text-center text-xs outline-none focus:border-accent"
                />
              </div>

              <div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${state.cls}`}>
                  {state.label}
                </span>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                {row.derived ? (
                  <span className="text-[11px] text-ink-muted">材料から自動</span>
                ) : (
                  <>
                    <StepButton
                      disabled={!!pending}
                      onClick={() => run(`dec-${row.id}`, () => decrementStock(row.id))}
                    >
                      −1
                    </StepButton>
                    <StepButton
                      disabled={!!pending}
                      onClick={() => run(`inc-${row.id}`, () => addStock(row.id, 1))}
                    >
                      ＋1
                    </StepButton>
                    <StepButton
                      disabled={!!pending}
                      onClick={() =>
                        run(`inc10-${row.id}`, () => addStock(row.id, 10), "10個追加しました。")
                      }
                      wide
                    >
                      ＋10 追加
                    </StepButton>
                  </>
                )}
                <button
                  onClick={() => {
                    if (guard()) return;
                    if (!confirm(`「${row.name}」を削除しますか？`)) return;
                    void run(`del-${row.id}`, () => deleteProduct(row.id), "削除しました。");
                  }}
                  className="press press-chip rounded-[8px] px-1.5 py-1 text-xs text-ink-placeholder hover:text-danger"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-muted">
            まだ商品がありません。「＋ 商品を登録」から追加してください。
          </p>
        )}
      </div>

      <p className="mt-2.5 text-xs text-ink-muted">
        「注文後に作る」商品の残数は、材料の在庫から「あと何個作れるか」を自動計算しています。
        「＋1」「＋10 追加」は仕込みとして記録され、レシピ通りに材料が減ります。
      </p>

      <ProductFormModal open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: string;
  note: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-[18px] py-4 ${
        alert ? "border-alert-border bg-alert-weak" : "border-border bg-surface"
      }`}
    >
      <div className={`text-[11px] font-bold ${alert ? "text-alert-deep" : "text-ink-muted"}`}>
        {label}
      </div>
      <div
        className={`num mt-1.5 text-[26px] font-bold tracking-[-.01em] ${
          alert ? "text-alert-deep" : ""
        }`}
      >
        {value}
      </div>
      <div className={`mt-0.5 text-[11px] ${alert ? "text-alert" : "text-ink-muted"}`}>{note}</div>
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  wide = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`press press-step rounded-[9px] border border-border bg-surface text-xs font-bold text-ink-2 hover:border-accent hover:text-accent-deep disabled:opacity-40 ${
        wide ? "px-2.5 py-[7px]" : "w-[34px] py-[7px]"
      }`}
    >
      {children}
    </button>
  );
}
