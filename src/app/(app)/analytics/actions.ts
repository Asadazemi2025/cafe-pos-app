"use server";

import { requireAuth } from "@/lib/auth";
import { requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";

export type MenuRankingRow = {
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  marginRate: number;
};

// 選択中イベントの、メニューごとの販売数・売上・粗利ランキング(販売数の多い順)
export async function getMenuRanking(): Promise<MenuRankingRow[]> {
  requireAuth();
  const eventId = requireCurrentEvent();

  const items = await prisma.saleItem.findMany({
    where: { sale: { eventId, voided: false, isTest: false } },
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

export type EventComparisonRow = {
  eventId: string;
  label: string;
  sales: number;
  profit: number;
  itemCount: number;
};

// イベントごとの売上・粗利の比較(どのイベントが良かったかを見るため)
export async function getEventComparison(): Promise<EventComparisonRow[]> {
  requireAuth();

  const events = await prisma.event.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      sales: {
        where: { voided: false, isTest: false },
        select: { totalAmount: true, totalCost: true, itemCount: true },
      },
      expenses: {
        where: { isTest: false },
        select: { amount: true },
      },
    },
  });

  return events.map((e) => {
    const sales = e.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
    const cost = e.sales.reduce((sum, s) => sum + s.totalCost.toNumber(), 0);
    const expenses = e.expenses.reduce((sum, x) => sum + x.amount.toNumber(), 0);
    return {
      eventId: e.id,
      label: `${e.name}(${e.date.toISOString().slice(5, 10)})`,
      sales,
      profit: sales - cost - expenses,
      itemCount: e.sales.reduce((sum, s) => sum + s.itemCount, 0),
    };
  });
}
