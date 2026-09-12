"use server";

import { requireAuth } from "@/lib/auth";
import { requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { getTestMode } from "@/lib/app-mode";
import { getIngredientStockMap } from "@/lib/event-stock";

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
    prisma.sale.findMany({ where: { eventId, voided: false, isTest: await getTestMode() } }),
    prisma.expense.aggregate({
      where: { eventId, isTest: await getTestMode() },
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

// 在庫はイベントごとなので、いま選んでいるイベントの残量で判定する
export async function getLowStockIngredients(): Promise<LowStockIngredientDTO[]> {
  requireAuth();
  const stocks = await getIngredientStockMap(requireCurrentEvent());
  const ingredients = await prisma.ingredient.findMany({
    where: { isTest: false, lowStockThreshold: { not: null } },
    orderBy: { name: "asc" },
  });
  return ingredients
    .map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      stock: stocks.get(i.id) ?? 0,
      lowStockThreshold: i.lowStockThreshold!.toNumber(),
    }))
    .filter((i) => i.stock <= i.lowStockThreshold);
}
