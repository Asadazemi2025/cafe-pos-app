"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDayKey } from "@/lib/date";

export type DailyTrendPoint = { day: string; sales: number; cost: number; profit: number };

// 直近days日分の、日ごとの売上・原価・粗利の推移
export async function getSalesTrend(days = 14): Promise<DailyTrendPoint[]> {
  requireAuth();
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const sales = await prisma.sale.findMany({
    where: { occurredAt: { gte: start, lte: end }, voided: false, isTest: false },
    select: { occurredAt: true, totalAmount: true, totalCost: true },
  });

  const byDay = new Map<string, { sales: number; cost: number }>();
  for (const s of sales) {
    const key = jstDayKey(s.occurredAt);
    const cur = byDay.get(key) ?? { sales: 0, cost: 0 };
    cur.sales += s.totalAmount.toNumber();
    cur.cost += s.totalCost.toNumber();
    byDay.set(key, cur);
  }

  const points: DailyTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const key = jstDayKey(d);
    const v = byDay.get(key) ?? { sales: 0, cost: 0 };
    points.push({ day: key.slice(5), sales: v.sales, cost: v.cost, profit: v.sales - v.cost });
  }
  return points;
}

export type MenuRankingRow = {
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  marginRate: number;
};

// 直近days日の、メニューごとの販売数・売上・粗利ランキング(販売数の多い順)
export async function getMenuRanking(days = 30): Promise<MenuRankingRow[]> {
  requireAuth();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const items = await prisma.saleItem.findMany({
    where: {
      sale: { occurredAt: { gte: start }, voided: false, isTest: false },
    },
    select: { name: true, quantity: true, amount: true, unitCost: true },
  });

  const byName = new Map<string, { quantity: number; revenue: number; cost: number }>();
  for (const item of items) {
    const cur = byName.get(item.name) ?? { quantity: 0, revenue: 0, cost: 0 };
    cur.quantity += item.quantity;
    cur.revenue += item.amount.toNumber();
    cur.cost += item.unitCost.toNumber() * item.quantity;
    byName.set(item.name, cur);
  }

  return [...byName.entries()]
    .map(([name, v]) => ({
      name,
      quantity: v.quantity,
      revenue: v.revenue,
      profit: v.revenue - v.cost,
      marginRate: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}
