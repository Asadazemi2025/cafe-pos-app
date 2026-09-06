import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getDashboardSummary, getLowStockIngredients } from "./dashboard-actions";
import { getCurrentEvent } from "@/lib/event";
import { yen } from "@/lib/money";

export default async function DashboardPage() {
  const [s, lowStock, currentEvent] = await Promise.all([
    getDashboardSummary(),
    getLowStockIngredients(),
    getCurrentEvent(),
  ]);

  const cards = [
    { label: "売上", value: s.salesTotal },
    { label: "原価", value: s.costTotal },
    { label: "経費", value: s.expenseTotal },
    { label: "粗利", value: s.profit, highlight: true },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {currentEvent ? `${currentEvent.name}(${currentEvent.date})` : "イベント未選択"} の実績
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border border-border p-4 shadow-card ${
              c.highlight ? "bg-accent-weak" : "bg-surface"
            }`}
          >
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className={`num mt-1 text-lg font-bold ${c.highlight ? "text-accent" : ""}`}>
              {yen(c.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-ink-muted">現金の売上</p>
          <p className="num mt-1 font-bold">{yen(s.cashTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-ink-muted">カードの売上</p>
          <p className="num mt-1 font-bold">{yen(s.cardTotal)}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-muted">このイベントの販売点数: {s.itemCount}点</p>

      {lowStock.length > 0 && (
        <div className="mt-8 max-w-lg rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-warning">
            <AlertTriangle size={16} />
            在庫が少ない材料
          </div>
          <div className="mt-3 space-y-1.5">
            {lowStock.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{i.name}</span>
                <span className="num text-ink-muted">
                  残り{i.stock.toLocaleString("ja-JP")}
                  {i.unit}(目安 {i.lowStockThreshold.toLocaleString("ja-JP")}
                  {i.unit})
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/ingredients"
            className="mt-3 inline-block text-xs font-medium text-accent underline"
          >
            材料・仕入れページで補充する
          </Link>
        </div>
      )}
    </div>
  );
}
