"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type ExpenseDTO = {
  id: string;
  name: string;
  amount: number;
  memo: string | null;
  spentOn: string;
};

export async function getExpenses(limit = 30): Promise<ExpenseDTO[]> {
  requireAuth();
  const expenses = await prisma.expense.findMany({
    where: { isTest: false },
    orderBy: { spentOn: "desc" },
    take: limit,
  });
  return expenses.map((e) => ({
    id: e.id,
    name: e.name,
    amount: e.amount.toNumber(),
    memo: e.memo,
    spentOn: e.spentOn.toISOString().slice(0, 10),
  }));
}

export async function createExpense(input: {
  name: string;
  amount: number;
  memo?: string;
  spentOn: string;
}): Promise<void> {
  requireEditAuth();
  if (!input.name.trim()) throw new Error("品名を入力してください。");
  if (input.amount <= 0) throw new Error("金額を入力してください。");

  await prisma.expense.create({
    data: {
      name: input.name.trim(),
      amount: new Prisma.Decimal(input.amount),
      memo: input.memo || null,
      spentOn: new Date(`${input.spentOn}T00:00:00+09:00`),
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/daily");
}

export async function deleteExpense(id: string): Promise<void> {
  requireEditAuth();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/daily");
}
