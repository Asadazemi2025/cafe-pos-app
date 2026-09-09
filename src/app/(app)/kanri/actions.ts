"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentEvent, requireCurrentEvent } from "@/lib/event";
import { getManagerialData, getProfitPlan, type ManagerialData } from "@/lib/managerial";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { KpiSourceDTO } from "@/lib/kpi";

export type ActionPlanDTO = {
  id: string;
  title: string;
  kpiName: string;
  kpiUnit: string;
  targetValue: number;
  source: KpiSourceDTO;
  manualValue: number | null;
  profitImpact: number;
  memo: string | null;
  /** 実績値。売上やアンケートから自動で入るものは、その日の数字 */
  actualValue: number | null;
  /** 達成率(0〜) */
  progress: number | null;
};

export type PlanDTO = {
  dailyProfitTarget: number;
  serviceHours: number;
  staffCount: number;
  memo: string;
};

export type KanriData = {
  eventName: string;
  dayLabel: string;
  plan: PlanDTO;
  data: ManagerialData;
  actions: ActionPlanDTO[];
  /** アクションプランの見込み利益増の合計 */
  plannedImpact: number;
  surveyScore: number | null;
};

export async function getKanri(): Promise<KanriData | null> {
  requireAuth();
  const event = await getCurrentEvent();
  if (!event) return null;

  const dayIndex = event.dayIndex;
  const [plan, data, actions, survey] = await Promise.all([
    getProfitPlan(event.id),
    getManagerialData(event.id, dayIndex),
    prisma.actionPlan.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.surveyResponse.aggregate({
      where: { eventId: event.id, dayIndex },
      _avg: { satisfaction: true },
      _count: true,
    }),
  ]);

  const surveyScore = survey._count > 0 ? (survey._avg.satisfaction ?? null) : null;

  // KPIの実績。自動のものは選択中の営業日の数字を当てる
  function actualFor(source: KpiSourceDTO, manual: number | null): number | null {
    switch (source) {
      case "SALES":
        return data.todaySales;
      case "MARGIN":
        return data.todayMargin;
      case "CUSTOMERS":
        return data.todayCustomers;
      case "UNIT_PRICE":
        return data.avgTicket;
      case "UNITS":
        return data.todayUnits;
      case "ATTACH_RATE":
        return data.todayAttachRate * 100;
      case "SURVEY_SCORE":
        return surveyScore;
      default:
        return manual;
    }
  }

  const dtos: ActionPlanDTO[] = actions.map((a) => {
    const manual = a.manualValue?.toNumber() ?? null;
    const target = a.targetValue.toNumber();
    const actual = actualFor(a.source, manual);
    return {
      id: a.id,
      title: a.title,
      kpiName: a.kpiName,
      kpiUnit: a.kpiUnit,
      targetValue: target,
      source: a.source,
      manualValue: manual,
      profitImpact: a.profitImpact.toNumber(),
      memo: a.memo,
      actualValue: actual,
      progress: actual !== null && target > 0 ? actual / target : null,
    };
  });

  const day = event.dayList[dayIndex];
  return {
    eventName: event.name,
    dayLabel: `${day.label} ／ ${day.dateLabel}`,
    plan,
    data,
    actions: dtos,
    plannedImpact: dtos.reduce((a, x) => a + x.profitImpact, 0),
    surveyScore,
  };
}

export async function saveProfitPlan(input: {
  dailyProfitTarget: number;
  serviceHours: number;
  staffCount: number;
  memo?: string;
}): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const data = {
    dailyProfitTarget: new Prisma.Decimal(Math.max(0, input.dailyProfitTarget || 0)),
    serviceHours: new Prisma.Decimal(Math.max(0.5, input.serviceHours || 6)),
    staffCount: Math.max(1, Math.round(input.staffCount || 1)),
    memo: input.memo?.trim() || null,
  };
  await prisma.profitPlan.upsert({
    where: { eventId },
    create: { eventId, ...data },
    update: data,
  });
  revalidatePath("/kanri");
}

export async function createActionPlan(input: {
  title: string;
  kpiName: string;
  kpiUnit: string;
  targetValue: number;
  source: KpiSourceDTO;
  profitImpact: number;
  memo?: string;
}): Promise<void> {
  requireEditAuth();
  if (!input.title.trim()) throw new Error("アクションプランを入力してください。");
  if (!input.kpiName.trim()) throw new Error("管理項目(KPI)を入力してください。");

  await prisma.actionPlan.create({
    data: {
      eventId: requireCurrentEvent(),
      title: input.title.trim(),
      kpiName: input.kpiName.trim(),
      kpiUnit: input.kpiUnit.trim(),
      targetValue: new Prisma.Decimal(input.targetValue || 0),
      source: input.source,
      profitImpact: new Prisma.Decimal(input.profitImpact || 0),
      memo: input.memo?.trim() || null,
    },
  });
  revalidatePath("/kanri");
}

export async function setKpiActual(id: string, value: number): Promise<void> {
  requireEditAuth();
  await prisma.actionPlan.update({
    where: { id },
    data: { manualValue: new Prisma.Decimal(value) },
  });
  revalidatePath("/kanri");
}

export async function deleteActionPlan(id: string): Promise<void> {
  requireEditAuth();
  await prisma.actionPlan.delete({ where: { id } });
  revalidatePath("/kanri");
}

/** 商品の提供時間(分)。制約1単位あたり利益の計算に使う */
export async function setPrepMinutes(menuItemId: string, minutes: number): Promise<void> {
  requireEditAuth();
  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { prepMinutes: new Prisma.Decimal(Math.max(0, minutes || 0)) },
  });
  revalidatePath("/kanri");
  revalidatePath("/stock");
}
