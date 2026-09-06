import { getMenuRanking, getEventComparison } from "./actions";
import { EventComparisonChart, MenuRankingTable } from "@/components/analytics/AnalyticsCharts";
import { getCurrentEvent } from "@/lib/event";

export default async function AnalyticsPage() {
  const [ranking, comparison, currentEvent] = await Promise.all([
    getMenuRanking(),
    getEventComparison(),
    getCurrentEvent(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">分析</h1>
      <p className="mt-1 text-sm text-ink-muted">
        選択中のイベントの売れ筋と、これまでのイベント同士の比較を確認できます。
      </p>

      <div className="mt-6">
        <EventComparisonChart data={comparison} />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-bold">
          売れ筋メニュー({currentEvent ? currentEvent.name : "選択中のイベント"})
        </p>
        <MenuRankingTable data={ranking} />
      </div>
    </div>
  );
}
