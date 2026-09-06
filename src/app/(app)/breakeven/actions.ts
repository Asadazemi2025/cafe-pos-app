"use server";

import { requireAuth } from "@/lib/auth";
import { requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";

export type BreakevenPoint = {
  time: number; // 表示用のタイムスタンプ(ms)
  cumulativeProfit: number; // 固定費を引いた後の累計利益
  cumulativeSales: number;
};

export type BreakevenSummary = {
  salesTotal: number;
  variableCost: number; // 売上原価
  marginalProfit: number; // 限界利益 = 売上 - 原価
  fixedCost: number; // 経費
  profit: number; // 限界利益 - 固定費
  marginRate: number; // 限界利益率(0-1)
  reached: boolean;
  // 黒字化まであと必要な売上。到達済みなら0
  requiredSales: number;
  points: BreakevenPoint[];
};

// 損益分岐点: 経費(固定費)を、限界利益(売上-原価)で回収できたかで見る。
export async function getBreakeven(): Promise<BreakevenSummary> {
  requireAuth();
  const eventId = requireCurrentEvent();

  const [sales, expenseAgg] = await Promise.all([
    prisma.sale.findMany({
      where: { eventId, voided: false, isTest: false },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, totalAmount: true, totalCost: true },
    }),
    prisma.expense.aggregate({
      where: { eventId, isTest: false },
      _sum: { amount: true },
    }),
  ]);

  const fixedCost = expenseAgg._sum.amount?.toNumber() ?? 0;

  let salesTotal = 0;
  let variableCost = 0;
  const points: BreakevenPoint[] = [];

  for (const s of sales) {
    salesTotal += s.totalAmount.toNumber();
    variableCost += s.totalCost.toNumber();
    points.push({
      time: s.occurredAt.getTime(),
      cumulativeSales: salesTotal,
      cumulativeProfit: salesTotal - variableCost - fixedCost,
    });
  }

  const marginalProfit = salesTotal - variableCost;
  const marginRate = salesTotal > 0 ? marginalProfit / salesTotal : 0;
  const profit = marginalProfit - fixedCost;

  // 限界利益率が分からない(まだ売上がない)ときは、必要売上も出せない
  const requiredSales =
    profit >= 0 ? 0 : marginRate > 0 ? Math.ceil((fixedCost - marginalProfit) / marginRate) : 0;

  return {
    salesTotal,
    variableCost,
    marginalProfit,
    fixedCost,
    profit,
    marginRate,
    reached: profit >= 0,
    requiredSales,
    points,
  };
}
