"use server";

import { requireAuth } from "@/lib/auth";
import { requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";

export type DashboardSummary = {
  salesTotal: number;
  costTotal: number;
  profit: number;
  cashTotal: number;
  cardTotal: number;
  itemCount: number;
  expenseTotal: number;
};

// 集計対象は「選択中のイベント」。日付ではなくイベント単位で見る。
export async function getDashboardSummary(): Promise<DashboardSummary> {
  requireAuth();
  const eventId = requireCurrentEvent();

  const [sales, expenseAgg] = await Promise.all([
    prisma.sale.findMany({ where: { eventId, voided: false, isTest: false } }),
    prisma.expense.aggregate({
      where: { eventId, isTest: false },
      _sum: { amount: true },
    }),
  ]);

  let salesTotal = 0;
  let costTotal = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let itemCount = 0;

  for (const s of sales) {
    const amount = s.totalAmount.toNumber();
    salesTotal += amount;
    costTotal += s.totalCost.toNumber();
    itemCount += s.itemCount;
    if (s.paymentMethod === "CASH") cashTotal += amount;
    else cardTotal += amount;
  }

  const expenseTotal = expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    salesTotal,
    costTotal,
    profit: salesTotal - costTotal - expenseTotal,
    cashTotal,
    cardTotal,
    itemCount,
    expenseTotal,
  };
}

export type LowStockIngredientDTO = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
};

// 在庫は全イベント共通なので、ここはイベントで絞らない
export async function getLowStockIngredients(): Promise<LowStockIngredientDTO[]> {
  requireAuth();
  const ingredients = await prisma.ingredient.findMany({
    where: { isTest: false, lowStockThreshold: { not: null } },
    orderBy: { name: "asc" },
  });
  return ingredients
    .filter((i) => i.lowStockThreshold !== null && i.stock.lte(i.lowStockThreshold))
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: i.stock.toNumber(),
      lowStockThreshold: i.lowStockThreshold!.toNumber(),
    }));
}
