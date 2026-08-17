"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { jstDayRange } from "@/lib/date";
import { sumCashCounts, type CashCounts } from "@/lib/denominations";

export type DailyRegisterDTO = {
  day: string;
  openingCash: number | null;
  openedAt: string | null;
  closingCash: number | null;
  expectedCash: number | null;
  closedAt: string | null;
  cashCounts: CashCounts | null;
};

function toDTO(row: {
  day: string;
  openingCash: Prisma.Decimal | null;
  openedAt: Date | null;
  closingCash: Prisma.Decimal | null;
  expectedCash: Prisma.Decimal | null;
  closedAt: Date | null;
  cashCounts: Prisma.JsonValue;
} | null): DailyRegisterDTO | null {
  if (!row) return null;
  return {
    day: row.day,
    openingCash: row.openingCash?.toNumber() ?? null,
    openedAt: row.openedAt?.toISOString() ?? null,
    closingCash: row.closingCash?.toNumber() ?? null,
    expectedCash: row.expectedCash?.toNumber() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    cashCounts: (row.cashCounts as CashCounts | null) ?? null,
  };
}

export async function getDailyRegister(day: string): Promise<DailyRegisterDTO | null> {
  requireAuth();
  const row = await prisma.dailyRegister.findUnique({ where: { day } });
  return toDTO(row);
}

// その日の現金売上-現金以外を除く経費・仕入は今回は対象外(材料仕入れは仕入れ画面側で管理するため)
async function cashSalesTotal(day: string): Promise<Prisma.Decimal> {
  const { start, end } = jstDayRange(day);
  const agg = await prisma.sale.aggregate({
    where: {
      occurredAt: { gte: start, lt: end },
      paymentMethod: "CASH",
      voided: false,
      isTest: false,
    },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? new Prisma.Decimal(0);
}

async function expenseTotal(day: string): Promise<Prisma.Decimal> {
  const { start, end } = jstDayRange(day);
  const agg = await prisma.expense.aggregate({
    where: { spentOn: { gte: start, lt: end }, isTest: false },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

export async function openDay(day: string, cashCounts: CashCounts): Promise<void> {
  requireEditAuth();
  const openingCash = new Prisma.Decimal(sumCashCounts(cashCounts));

  await prisma.dailyRegister.upsert({
    where: { day },
    create: { day, openingCash, openedAt: new Date(), cashCounts },
    update: {
      openingCash,
      openedAt: new Date(),
      cashCounts,
      closingCash: null,
      expectedCash: null,
      closedAt: null,
    },
  });
  revalidatePath("/daily");
}

export async function closeDay(
  day: string,
  closingCash: number,
): Promise<{ diff: number; expectedCash: number }> {
  requireEditAuth();
  const register = await prisma.dailyRegister.findUnique({ where: { day } });
  if (!register || register.openingCash === null) {
    throw new Error("先に「レジ初め」を行ってください。");
  }

  const sales = await cashSalesTotal(day);
  const expenses = await expenseTotal(day);
  const expectedCash = register.openingCash.add(sales).sub(expenses);
  const closingDecimal = new Prisma.Decimal(closingCash);

  await prisma.dailyRegister.update({
    where: { day },
    data: { closingCash: closingDecimal, expectedCash, closedAt: new Date() },
  });

  revalidatePath("/daily");
  return { diff: closingDecimal.sub(expectedCash).toNumber(), expectedCash: expectedCash.toNumber() };
}

export async function resetDay(day: string): Promise<void> {
  requireEditAuth();
  await prisma.dailyRegister.deleteMany({ where: { day } });
  revalidatePath("/daily");
}

export async function getCurrentExpectedCash(day: string): Promise<number | null> {
  requireAuth();
  const register = await prisma.dailyRegister.findUnique({ where: { day } });
  if (!register || register.openingCash === null) return null;
  const sales = await cashSalesTotal(day);
  const expenses = await expenseTotal(day);
  return register.openingCash.add(sales).sub(expenses).toNumber();
}
