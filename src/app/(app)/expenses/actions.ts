"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentEvent, requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type ExpenseScopeDTO = "PER_DAY" | "WHOLE_EVENT";

export type ExpenseDTO = {
  id: string;
  name: string;
  amount: number;
  scope: ExpenseScopeDTO;
  /** 1日あたりに換算した金額(イベント全体の費用は営業日数で按分) */
  perDay: number;
  memo: string | null;
  spentOn: string;
};

export type ExpenseSummary = {
  days: number;
  /** イベント全体としてかかる費用(出店料など) */
  wholeTotal: number;
  /** 毎日かかる費用 */
  perDayTotal: number;
  /** 損益分岐点に使う固定費 / 日 */
  fixedPerDay: number;
  /** イベント期間の合計 */
  eventTotal: number;
};

export async function getExpenses(): Promise<{ rows: ExpenseDTO[]; summary: ExpenseSummary }> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const days = Math.max(1, event.days);

  const expenses = await prisma.expense.findMany({
    where: { isTest: false, eventId },
    orderBy: { createdAt: "desc" },
  });

  const rows: ExpenseDTO[] = expenses.map((e) => {
    const amount = e.amount.toNumber();
    return {
      id: e.id,
      name: e.name,
      amount,
      scope: e.scope,
      perDay: e.scope === "WHOLE_EVENT" ? amount / days : amount,
      memo: e.memo,
      spentOn: e.spentOn.toISOString().slice(0, 10),
    };
  });

  const wholeTotal = rows
    .filter((r) => r.scope === "WHOLE_EVENT")
    .reduce((s, r) => s + r.amount, 0);
  const perDayTotal = rows.filter((r) => r.scope === "PER_DAY").reduce((s, r) => s + r.amount, 0);

  return {
    rows,
    summary: {
      days,
      wholeTotal,
      perDayTotal,
      // README の計算ロジックと同じ丸め方
      fixedPerDay: Math.round(perDayTotal + wholeTotal / days),
      eventTotal: perDayTotal * days + wholeTotal,
    },
  };
}

export async function createExpense(input: {
  name: string;
  amount: number;
  scope: ExpenseScopeDTO;
  memo?: string;
}): Promise<void> {
  requireEditAuth();
  if (!input.name.trim()) throw new Error("費目を入力してください。");
  if (input.amount <= 0) throw new Error("金額を入力してください。");

  const eventId = requireCurrentEvent();
  const event = await getCurrentEvent();
  // 支出日は選択中の営業日にそろえる(フォームでは日付を聞かない)
  const spentOn = event?.dayList[event.dayIndex]?.date ?? event?.start;

  await prisma.expense.create({
    data: {
      eventId,
      name: input.name.trim(),
      amount: new Prisma.Decimal(input.amount),
      scope: input.scope,
      memo: input.memo?.trim() || null,
      spentOn: new Date(`${spentOn}T00:00:00Z`),
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/analytics");
  revalidatePath("/review");
}

export async function deleteExpense(id: string): Promise<void> {
  requireEditAuth();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/analytics");
  revalidatePath("/review");
}
