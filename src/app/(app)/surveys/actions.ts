"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { getAllDaySummaries } from "@/lib/day-summary";
import { prisma } from "@/lib/prisma";

export type SurveyDayRow = {
  dayIndex: number;
  label: string;
  dateLabel: string;
  responses: number;
  avgSatisfaction: number | null;
  sales: number;
  customers: number;
  avgTicket: number;
};

export type BreakdownRow = { label: string; count: number; rate: number };

export type SurveyCommentRow = {
  id: string;
  satisfaction: number;
  comment: string;
  ageGroup: string | null;
  dayLabel: string;
  createdAt: string;
};

export type SurveyData = {
  eventId: string;
  eventName: string;
  total: number;
  avgSatisfaction: number | null;
  avgRepeatIntent: number | null;
  /** 満足度1〜5の分布 */
  distribution: { score: number; count: number; rate: number }[];
  /** 回答率(回答数 ÷ 会計数) */
  responseRate: number | null;
  byDay: SurveyDayRow[];
  ageGroups: BreakdownRow[];
  knownFrom: BreakdownRow[];
  favorites: BreakdownRow[];
  comments: SurveyCommentRow[];
  /** 自動で出した気づき */
  insights: string[];
};

function breakdown(values: (string | null)[]): BreakdownRow[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
    total += 1;
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count, rate: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getSurveyData(): Promise<SurveyData | null> {
  requireAuth();
  const event = await getCurrentEvent();
  if (!event) return null;

  const [responses, summaries] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
    }),
    getAllDaySummaries(event.id),
  ]);

  const total = responses.length;
  const avg = (nums: number[]) =>
    nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

  const avgSatisfaction = avg(responses.map((r) => r.satisfaction));
  const avgRepeatIntent = avg(
    responses.filter((r) => r.repeatIntent !== null).map((r) => r.repeatIntent as number),
  );

  const distribution = [1, 2, 3, 4, 5].map((score) => {
    const count = responses.filter((r) => r.satisfaction === score).length;
    return { score, count, rate: total > 0 ? count / total : 0 };
  });

  const byDay: SurveyDayRow[] = event.dayList.map((day, i) => {
    const dayResponses = responses.filter((r) => r.dayIndex === day.index);
    const s = summaries[i];
    return {
      dayIndex: day.index,
      label: day.label,
      dateLabel: day.dateLabel,
      responses: dayResponses.length,
      avgSatisfaction: avg(dayResponses.map((r) => r.satisfaction)),
      sales: s?.sales ?? 0,
      customers: s?.saleCount ?? 0,
      avgTicket: s && s.saleCount > 0 ? s.sales / s.saleCount : 0,
    };
  });

  const totalCustomers = summaries.reduce((a, s) => a + s.saleCount, 0);

  // ---- 自動の気づき ----
  const insights: string[] = [];
  if (total > 0 && avgSatisfaction !== null) {
    insights.push(
      `満足度の平均は ${avgSatisfaction.toFixed(1)} / 5(${total}件)。` +
        `「4」以上が ${Math.round(
          ((distribution[3].count + distribution[4].count) / total) * 100,
        )}% です。`,
    );
  }
  const ages = breakdown(responses.map((r) => r.ageGroup));
  if (ages.length > 0) {
    insights.push(
      `お客さまの中心は ${ages[0].label}(${Math.round(ages[0].rate * 100)}%)。` +
        `この層に向けた商品と価格になっているかを見直せます。`,
    );
  }
  const known = breakdown(responses.map((r) => r.knownFrom));
  if (known.length > 0) {
    insights.push(
      `知ったきっかけの1位は「${known[0].label}」(${Math.round(known[0].rate * 100)}%)。` +
        `次回の告知は、ここに力を入れるのが効率的です。`,
    );
  }
  const favorites = breakdown(responses.map((r) => r.favoriteItem));
  if (favorites.length > 0) {
    const topSeller = summaries
      .flatMap((s) => s.perProduct)
      .sort((a, b) => b.sales - a.sales)[0];
    if (topSeller && topSeller.name !== favorites[0].label) {
      insights.push(
        `いちばん評価が高いのは「${favorites[0].label}」ですが、いちばん売れているのは「${topSeller.name}」です。` +
          `評価の高い商品が売れていないなら、見せ方や声かけに伸びしろがあります。`,
      );
    } else {
      insights.push(
        `評価が高い商品と売れている商品はどちらも「${favorites[0].label}」。看板商品として押し出せます。`,
      );
    }
  }
  // 満足度と客単価の関係(日ごと)
  const withBoth = byDay.filter((d) => d.responses > 0 && d.customers > 0);
  if (withBoth.length >= 2) {
    const best = [...withBoth].sort(
      (a, b) => (b.avgSatisfaction ?? 0) - (a.avgSatisfaction ?? 0),
    )[0];
    insights.push(
      `満足度がいちばん高かったのは ${best.label}(${best.avgSatisfaction?.toFixed(1)})。` +
        `その日の客単価は ${Math.round(best.avgTicket).toLocaleString("ja-JP")}円でした。`,
    );
  }

  const dayLabelOf = (i: number) => event.dayList[i]?.label ?? "";

  return {
    eventId: event.id,
    eventName: event.name,
    total,
    avgSatisfaction,
    avgRepeatIntent,
    distribution,
    responseRate: totalCustomers > 0 ? total / totalCustomers : null,
    byDay,
    ageGroups: ages,
    knownFrom: known,
    favorites,
    comments: responses
      .filter((r) => r.comment)
      .slice(0, 30)
      .map((r) => ({
        id: r.id,
        satisfaction: r.satisfaction,
        comment: r.comment as string,
        ageGroup: r.ageGroup,
        dayLabel: dayLabelOf(r.dayIndex),
        createdAt: r.createdAt.toISOString(),
      })),
    insights,
  };
}

export async function deleteSurveyResponse(id: string): Promise<void> {
  requireEditAuth();
  await prisma.surveyResponse.delete({ where: { id } });
  revalidatePath("/surveys");
}
