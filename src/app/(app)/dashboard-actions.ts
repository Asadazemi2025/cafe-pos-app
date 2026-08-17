"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDayRange, todayJST } from "@/lib/date";

export type DashboardSummary = {
  day: string;
  salesTotal: number;
  costTotal: number;
  profit: number;
  cashTotal: number;
  cardTotal: number;
  itemCount: number;
  expenseTotal: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  requireAuth();
  const day = todayJST();
  const { start, end } = jstDayRange(day);

  const [sales, expenseAgg] = await Promise.all([
    prisma.sale.findMany({
      where: { occurredAt: { gte: start, lt: end }, voided: false, isTest: false },
    }),
    prisma.expense.aggregate({
      where: { spentOn: { gte: start, lt: end }, isTest: false },
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
    day,
    salesTotal,
    costTotal,
    profit: salesTotal - costTotal - expenseTotal,
    cashTotal,
    cardTotal,
    itemCount,
    expenseTotal,
  };
}
