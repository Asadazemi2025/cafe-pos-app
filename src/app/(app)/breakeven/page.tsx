import { getBreakeven } from "./actions";
import { BreakevenChart } from "@/components/breakeven/BreakevenChart";
import { getCurrentEvent } from "@/lib/event";
import { yen } from "@/lib/money";

export default async function BreakevenPage() {
  const [b, currentEvent] = await Promise.all([getBreakeven(), getCurrentEvent()]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">損益分岐点</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {currentEvent ? `${currentEvent.name}(${currentEvent.date})` : "イベント未選択"}
        の売上・原価・経費から、黒字まであといくらかを計算します。
      </p>

      <div
        className={`mt-6 rounded-lg border p-5 shadow-card ${
          b.reached ? "border-success/30 bg-success/10" : "border-accent/30 bg-accent-weak"
        }`}
      >
        {b.reached ? (
          <>
            <p className="text-sm font-bold text-success">黒字達成</p>
            <p className="num mt-1 text-2xl font-bold text-success">{yen(b.profit)}</p>
            <p className="mt-1 text-xs text-ink-muted">
              経費({yen(b.fixedCost)})を回収したうえでの利益です。
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-accent">黒字まであと</p>
            <p className="num mt-1 text-2xl font-bold text-accent">
              {b.requiredSales > 0 ? yen(b.requiredSales) : "—"}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {b.requiredSales > 0
                ? `この売上を追加できれば、経費(${yen(b.fixedCost)})を回収できます。`
                : "まだ売上がないため、必要な売上を計算できません。"}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "売上", value: yen(b.salesTotal) },
          { label: "原価(変動費)", value: yen(b.variableCost) },
          { label: "経費(固定費)", value: yen(b.fixedCost) },
          { label: "限界利益率", value: `${(b.marginRate * 100).toFixed(0)}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className="num mt-1 text-lg font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <BreakevenChart points={b.points} />
      </div>
    </div>
  );
}
