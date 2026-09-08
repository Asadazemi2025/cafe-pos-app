"use server";

import { requireAuth } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { getAllDaySummaries, HOURS, type DaySummary } from "@/lib/day-summary";

export type HeatmapRow = {
  dayIndex: number;
  label: string;
  dateLabel: string;
  /** 10〜16時の売上 */
  hours: number[];
  total: number;
};

export type AnalyticsData = {
  eventName: string;
  dayIndex: number;
  hours: string[];
  summary: DaySummary;
  heatmap: HeatmapRow[];
};

// 選択中イベントの全営業日を集計する。
// 分岐点カード・商品別・時間帯別は「選択中の日」、ヒートマップは全日を並べる。
export async function getAnalytics(): Promise<AnalyticsData | null> {
  requireAuth();
  const event = await getCurrentEvent();
  if (!event) return null;

  const summaries = await getAllDaySummaries(event.id);

  return {
    eventName: event.name,
    dayIndex: event.dayIndex,
    hours: HOURS,
    summary: summaries[event.dayIndex] ?? summaries[0],
    heatmap: event.dayList.map((day, i) => ({
      dayIndex: day.index,
      label: day.label,
      dateLabel: day.dateLabel,
      hours: summaries[i].byHour.map((h) => h.sales),
      total: summaries[i].sales,
    })),
  };
}
