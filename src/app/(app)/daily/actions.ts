"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

// レジ初め・締めは1イベントにつき1回。日付ではなくイベントを鍵にする。
export async function getDailyRegister(): Promise<DailyRegisterDTO | null> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const row = await prisma.dailyRegister.findUnique({ where: { eventId } });
  return toDTO(row);
}

// そのイベントの現金売上(現金過不足の計算に使う。カード決済は現金に影響しないため除外)
async function cashSalesTotal(eventId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.sale.aggregate({
    where: { eventId, paymentMethod: "CASH", voided: false, isTest: false },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? new Prisma.Decimal(0);
}

async function expenseTotal(eventId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.expense.aggregate({
    where: { eventId, isTest: false },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

export async function openDay(day: string, cashCounts: CashCounts): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const openingCash = new Prisma.Decimal(sumCashCounts(cashCounts));

  await prisma.dailyRegister.upsert({
    where: { eventId },
    create: { eventId, day, openingCash, openedAt: new Date(), cashCounts },
    update: {
      day,
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
  closingCash: number,
): Promise<{ diff: number; expectedCash: number }> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const register = await prisma.dailyRegister.findUnique({ where: { eventId } });
  if (!register || register.openingCash === null) {
    throw new Error("先に「レジ初め」を行ってください。");
  }

  const sales = await cashSalesTotal(eventId);
  const expenses = await expenseTotal(eventId);
  const expectedCash = register.openingCash.add(sales).sub(expenses);
  const closingDecimal = new Prisma.Decimal(closingCash);

  await prisma.dailyRegister.update({
    where: { eventId },
    data: { closingCash: closingDecimal, expectedCash, closedAt: new Date() },
  });

  revalidatePath("/daily");
  return {
    diff: closingDecimal.sub(expectedCash).toNumber(),
    expectedCash: expectedCash.toNumber(),
  };
}

export async function resetDay(): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  await prisma.dailyRegister.deleteMany({ where: { eventId } });
  revalidatePath("/daily");
}

export async function getCurrentExpectedCash(): Promise<number | null> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const register = await prisma.dailyRegister.findUnique({ where: { eventId } });
  if (!register || register.openingCash === null) return null;
  const sales = await cashSalesTotal(eventId);
  const expenses = await expenseTotal(eventId);
  return register.openingCash.add(sales).sub(expenses).toNumber();
}
