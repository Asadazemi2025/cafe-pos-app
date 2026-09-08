"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { selectDay } from "@/app/select-event/actions";
import type { AnalyticsData } from "@/app/(app)/analytics/actions";
import { yen } from "@/lib/money";

// ヒートマップのセル色。紙色 → 深緑を t^0.75 で補間する(README)
const FROM = [243, 240, 233];
const TO = [47, 111, 94];

function cellColor(t: number): string {
  const k = Math.pow(Math.max(0, Math.min(1, t)), 0.75);
  const c = FROM.map((f, i) => Math.round(f + (TO[i] - f) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// 「12,340」→「12k」
function short(v: number): string {
  if (v <= 0) return "";
  if (v < 1000) return String(Math.round(v));
  return `${Math.round(v / 1000)}k`;
}

export function AnalyticsBoard({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { summary, heatmap, hours } = data;

  // 進捗バーのスケール(README): max(分岐点×1.35, 売上×1.1)
  const scale = Math.max(summary.bepSales * 1.35, summary.sales * 1.1, 1);
  const salesRatio = Math.min(1, summary.sales / scale);
  const bepRatio = Math.min(1, summary.bepSales / scale);
  const reached = summary.over >= 0;

  const maxCell = Math.max(1, ...heatmap.flatMap((r) => r.hours));
  const topProducts = summary.perProduct.slice(0, 6);
  const maxProduct = Math.max(1, ...topProducts.map((p) => p.sales));
  const maxHour = Math.max(1, ...summary.byHour.map((h) => h.sales));

  const customers = summary.saleCount;
  const perCustomer = customers > 0 ? summary.sales / customers : 0;

  async function handleSelectDay(index: number) {
    if (index === data.dayIndex) return;
    setPending(true);
    try {
      await selectDay(index);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="anim-fade-up space-y-3.5 p-[22px]">
      <div className="flex items-stretch gap-3.5">
        {/* 損益分岐点 */}
        <div className="flex-[1.35] rounded-2xl border border-border bg-surface px-[22px] py-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[15px] font-bold">損益分岐点</h2>
            <span className="num text-[11px] text-ink-muted">
              固定費 {yen(summary.fixedCost)} ／ 変動費率{" "}
              {Math.round(summary.varRate * 100)}%
            </span>
          </div>

          <div className="num mt-2 text-[40px] font-bold leading-none tracking-[-.02em]">
            {yen(summary.bepSales)}
          </div>
          <div className="mt-1 text-[11px] text-ink-muted">この日の黒字ラインとなる売上</div>

          <div className="relative mt-4 h-[38px] overflow-hidden rounded-xl bg-surface-hover">
            <div
              className="h-full rounded-xl bg-accent transition-[width] duration-500"
              style={{ width: `${salesRatio * 100}%` }}
            />
            <div
              className="absolute inset-y-0 w-[2px] bg-dark"
              style={{ left: `${bepRatio * 100}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
            <span className="num">売上 {yen(summary.sales)}</span>
            <span className="num">分岐点 {yen(summary.bepSales)}</span>
          </div>

          <div
            className={`mt-3.5 rounded-xl px-4 py-3 text-[13px] ${
              reached ? "bg-accent-weak-2 text-accent-deep" : "bg-accent-weak text-accent-deep"
            }`}
          >
            {reached ? (
              <>
                分岐点を {yen(summary.over)} 上回っています。ここから先の売上は、
                {Math.round(summary.cmRate * 100)}% が利益として残ります。
              </>
            ) : (
              <>
                黒字まであと {yen(-summary.over)}。
                {summary.topProduct
                  ? `主力の「${summary.topProduct.name}」なら あと${summary.unitsToBep}個 で到達します。`
                  : "まだ売上がないため、まずは1件目の会計から。"}
              </>
            )}
          </div>
        </div>

        {/* 右3カード */}
        <div className="flex flex-1 flex-col gap-3.5">
          <MiniCard
            label="粗利(この日)"
            value={yen(summary.margin)}
            note={`粗利率 ${summary.sales > 0 ? Math.round((summary.margin / summary.sales) * 100) : 0}%`}
          />
          <MiniCard
            label="客数 ／ 客単価"
            value={`${customers} 組`}
            note={`客単価 ${yen(perCustomer)} ／ ${summary.unitCount}点`}
          />
          <MiniCard
            label="あと何個で黒字"
            value={reached ? "達成" : `${summary.unitsToBep} 個`}
            note={
              reached
                ? `${yen(summary.over)} 上振れ`
                : summary.topProduct
                  ? `「${summary.topProduct.name}」換算`
                  : "主力商品が未確定"
            }
            accent={reached}
          />
        </div>
      </div>

      {/* 日付 × 時間帯ヒートマップ */}
      <div className="rounded-2xl border border-border bg-surface px-[22px] py-5">
        <div className="flex items-center">
          <h2 className="text-[15px] font-bold">日付 × 時間帯の売上</h2>
          <span className="ml-3 text-[11px] text-ink-muted">
            行をタップするとその日に切り替わります
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-ink-muted">
            少
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span
                key={t}
                className="h-3 w-5 rounded-[3px] border border-border"
                style={{ background: cellColor(t) }}
              />
            ))}
            多
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-[112px_repeat(7,1fr)_86px] items-center gap-1.5 text-[10px] text-ink-muted">
          <div />
          {hours.map((h) => (
            <div key={h} className="num text-center">
              {h}時
            </div>
          ))}
          <div className="num text-right">日合計</div>
        </div>

        <div className="mt-1 space-y-1.5">
          {heatmap.map((row) => {
            const selected = row.dayIndex === data.dayIndex;
            return (
              <button
                key={row.dayIndex}
                onClick={() => handleSelectDay(row.dayIndex)}
                disabled={pending}
                className={`press press-row grid w-full grid-cols-[112px_repeat(7,1fr)_86px] items-center gap-1.5 rounded-xl border px-1.5 py-1 text-left ${
                  selected ? "border-[1.5px] border-accent bg-accent-weak" : "border-transparent"
                }`}
              >
                <div className="pl-1.5 text-[11px] font-bold">
                  {row.label}
                  <span className="num ml-1 font-normal text-ink-muted">{row.dateLabel}</span>
                </div>
                {row.hours.map((v, i) => {
                  const t = v / maxCell;
                  return (
                    <div
                      key={i}
                      className="num flex h-9 items-center justify-center rounded-sm text-[11px] font-bold"
                      style={{ background: cellColor(t), color: t > 0.55 ? "#fff" : undefined }}
                    >
                      {short(v)}
                    </div>
                  );
                })}
                <div className="num pr-1.5 text-right text-xs font-bold">{yen(row.total)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 商品別・時間帯別 */}
      <div className="flex items-stretch gap-3.5">
        <div className="flex-1 rounded-2xl border border-border bg-surface px-[22px] py-5">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[15px] font-bold">商品別 売上と粗利</h2>
            <span className="flex items-center gap-2.5 text-[10px] text-ink-muted">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-dark" />原価
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-accent-soft" />粗利
              </span>
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {topProducts.map((p) => (
              <div key={p.name}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-bold">{p.name}</span>
                  <span className="num text-ink-muted">
                    {p.quantity}点 ／ {yen(p.sales)}
                  </span>
                </div>
                <div className="mt-1.5 flex h-[14px] w-full overflow-hidden rounded-sm bg-surface-hover">
                  <div
                    className="h-full bg-dark transition-[width] duration-300"
                    style={{ width: `${(p.cost / maxProduct) * 100}%` }}
                  />
                  <div
                    className="h-full bg-accent-soft transition-[width] duration-300"
                    style={{ width: `${(p.margin / maxProduct) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-muted">
                この日はまだ売上がありません。
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-border bg-surface px-[22px] py-5">
          <h2 className="text-[15px] font-bold">時間帯別の売上</h2>
          <div className="mt-4 flex h-[168px] items-end gap-2.5">
            {summary.byHour.map((h) => {
              const isMax = h.sales === maxHour && h.sales > 0;
              return (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="num text-[10px] text-ink-muted">{short(h.sales)}</div>
                  <div
                    className={`w-full rounded-sm transition-[height] duration-300 ${
                      isMax ? "bg-accent" : "bg-[#ded9cd]"
                    }`}
                    style={{ height: `${Math.max(2, (h.sales / maxHour) * 120)}px` }}
                  />
                  <div className="num text-[10px] text-ink-muted">{h.hour}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl border px-[18px] py-4 ${
        accent ? "border-[#cfe0d8] bg-accent-weak-2" : "border-border bg-surface"
      }`}
    >
      <div className={`text-[11px] font-bold ${accent ? "text-accent-deep" : "text-ink-muted"}`}>
        {label}
      </div>
      <div
        className={`num mt-1 text-[24px] font-bold tracking-[-.01em] ${
          accent ? "text-accent-deep" : ""
        }`}
      >
        {value}
      </div>
      <div className={`mt-0.5 text-[11px] ${accent ? "text-accent-deep/80" : "text-ink-muted"}`}>
        {note}
      </div>
    </div>
  );
}
