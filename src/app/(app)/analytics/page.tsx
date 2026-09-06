import { getSalesTrend, getMenuRanking } from "./actions";
import { SalesTrendChart, MenuRankingTable } from "@/components/analytics/AnalyticsCharts";

export default async function AnalyticsPage() {
  const [trend, ranking] = await Promise.all([getSalesTrend(14), getMenuRanking(30)]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">分析</h1>
      <p className="mt-1 text-sm text-ink-muted">
        直近14日間の売上推移と、直近30日間の売れ筋メニューを確認できます。
      </p>

      <div className="mt-6">
        <SalesTrendChart data={trend} />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-bold">売れ筋メニュー(直近30日)</p>
        <MenuRankingTable data={ranking} />
      </div>
    </div>
  );
}
