"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sumCashCounts, type CashCounts } from "@/lib/denominations";

// 営業日ごとのレジ開け/締め(README の Session)。
// 理論在高 = 釣銭準備金 + 現金売上、差異 = 数えた現金 - 理論在高。

export type SessionDTO = {
  dayIndex: number;
  day: string;
  opened: boolean;
  closed: boolean;
  openCash: number;
  counted: number | null;
  theoretical: number;
  diff: number | null;
  closedAt: string | null;
  openCounts: CashCounts | null;
  closeCounts: CashCounts | null;
  /** 内訳(締め画面の表示用) */
  cashSales: number;
  cashlessSales: number;
};

async function salesByMethod(eventId: string, dayIndex: number) {
  const rows = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: { eventId, dayIndex, voided: false, isTest: false },
    _sum: { totalAmount: true },
  });
  let cash = 0;
  let cashless = 0;
  for (const r of rows) {
    const v = r._sum.totalAmount?.toNumber() ?? 0;
    if (r.paymentMethod === "CASH") cash += v;
    else cashless += v;
  }
  return { cash, cashless };
}

export async function getSession(): Promise<SessionDTO> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();

  const [row, methods] = await Promise.all([
    prisma.dailyRegister.findUnique({ where: { eventId_dayIndex: { eventId, dayIndex } } }),
    salesByMethod(eventId, dayIndex),
  ]);

  const openCash = row?.openingCash?.toNumber() ?? 0;
  const counted = row?.closingCash?.toNumber() ?? null;
  const theoretical = openCash + methods.cash;

  return {
    dayIndex,
    day: row?.day ?? "",
    opened: !!row?.openedAt,
    closed: !!row?.closedAt,
    openCash,
    counted,
    theoretical,
    diff: counted === null ? null : counted - theoretical,
    closedAt: row?.closedAt?.toISOString() ?? null,
    openCounts: (row?.cashCounts as CashCounts | null) ?? null,
    closeCounts: (row?.closeCounts as CashCounts | null) ?? null,
    cashSales: methods.cash,
    cashlessSales: methods.cashless,
  };
}

export async function openRegister(day: string, counts: CashCounts): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();
  const openingCash = new Prisma.Decimal(sumCashCounts(counts));
  if (openingCash.lte(0)) throw new Error("釣銭準備金を入力してください。");

  await prisma.dailyRegister.upsert({
    where: { eventId_dayIndex: { eventId, dayIndex } },
    create: { eventId, dayIndex, day, openingCash, openedAt: new Date(), cashCounts: counts },
    update: {
      day,
      openingCash,
      openedAt: new Date(),
      cashCounts: counts,
      closingCash: null,
      expectedCash: null,
      closedAt: null,
      closeCounts: Prisma.DbNull,
    },
  });
  revalidatePath("/register");
}

export async function closeRegister(counts: CashCounts): Promise<{ diff: number }> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();

  const row = await prisma.dailyRegister.findUnique({
    where: { eventId_dayIndex: { eventId, dayIndex } },
  });
  if (!row?.openedAt || row.openingCash === null) {
    throw new Error("先にレジをはじめてください。");
  }

  const methods = await salesByMethod(eventId, dayIndex);
  const counted = new Prisma.Decimal(sumCashCounts(counts));
  const theoretical = row.openingCash.add(methods.cash);

  await prisma.dailyRegister.update({
    where: { eventId_dayIndex: { eventId, dayIndex } },
    data: {
      closingCash: counted,
      expectedCash: theoretical,
      closedAt: new Date(),
      closeCounts: counts,
    },
  });

  revalidatePath("/register");
  return { diff: counted.sub(theoretical).toNumber() };
}

export async function reopenRegister(): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();
  await prisma.dailyRegister.updateMany({
    where: { eventId, dayIndex },
    data: { closingCash: null, expectedCash: null, closedAt: null, closeCounts: Prisma.DbNull },
  });
  revalidatePath("/register");
}
