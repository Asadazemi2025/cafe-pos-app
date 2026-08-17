import { getDashboardSummary } from "./dashboard-actions";
import { yen } from "@/lib/money";

export default async function DashboardPage() {
  const s = await getDashboardSummary();

  const cards = [
    { label: "本日の売上", value: s.salesTotal },
    { label: "原価", value: s.costTotal },
    { label: "経費", value: s.expenseTotal },
    { label: "粗利", value: s.profit, highlight: true },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
      <p className="mt-1 text-sm text-ink-muted">{s.day} の実績</p>

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

      <p className="mt-4 text-xs text-ink-muted">本日の販売点数: {s.itemCount}点</p>
    </div>
  );
}
