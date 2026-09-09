"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";

import { performSale, voidSale as voidSaleCore, type CartLine } from "@/lib/register-sale";

export type PaymentMethodDTO = "CASH" | "CARD" | "PAYPAY";

export type RegisterMenuItemDTO = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
  costPrice: number;
  stockMode: "MADE_TO_ORDER" | "PREPARED";
  preparedStock: number;
  par: number;
};

export async function getRegisterMenu(): Promise<RegisterMenuItemDTO[]> {
  requireAuth();
  // メニューとレシピを同時に読み、原価はこの場で計算する(往復を減らして表示を速くする)
  const [items, recipes] = await Promise.all([
    prisma.menuItem.findMany({
      where: { showInRegister: true, isTest: false },
      orderBy: { name: "asc" },
    }),
    prisma.recipeIngredient.findMany({
      select: { menuItemId: true, quantityPerUnit: true, ingredient: { select: { costPerUnit: true } } },
    }),
  ]);

  const costs = new Map<string, number>();
  for (const line of recipes) {
    costs.set(
      line.menuItemId,
      (costs.get(line.menuItemId) ?? 0) +
        line.quantityPerUnit.toNumber() * line.ingredient.costPerUnit.toNumber(),
    );
  }

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    salePrice: i.salePrice.toNumber(),
    costPrice: costs.get(i.id) ?? 0,
    stockMode: i.stockMode,
    preparedStock: i.preparedStock,
    par: i.par,
  }));
}

export type RecentSaleDTO = {
  id: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
  voided: boolean;
  occurredAt: string;
};

export async function getRecentSales(): Promise<RecentSaleDTO[]> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();
  const sales = await prisma.sale.findMany({
    where: { eventId, dayIndex, isTest: false },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });
  return sales.map((s) => ({
    id: s.id,
    totalAmount: s.totalAmount.toNumber(),
    itemCount: s.itemCount,
    paymentMethod: s.paymentMethod,
    voided: s.voided,
    occurredAt: s.occurredAt.toISOString(),
  }));
}

export type CheckoutResult =
  | { ok: true; saleId: string; saleNo: string; duplicate: boolean }
  | { ok: false; message: string };

export async function checkout(input: {
  items: CartLine[];
  method: PaymentMethodDTO;
  clientId?: string;
}): Promise<CheckoutResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();

  // 締め済み・未開店のレジでは会計できない
  const session = await prisma.dailyRegister.findUnique({
    where: { eventId_dayIndex: { eventId, dayIndex } },
  });
  if (!session?.openedAt) return { ok: false, message: "先にレジをはじめてください。" };
  if (session.closedAt) return { ok: false, message: "このレジは締め済みです。" };

  try {
    const result = await performSale({
      items: input.items,
      paymentMethod: input.method,
      eventId,
      dayIndex,
      clientId: input.clientId ?? null,
    });
    revalidatePath("/register");
    return {
      ok: true,
      saleId: result.saleId,
      saleNo: result.saleNo,
      duplicate: result.duplicate,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "会計に失敗しました。" };
  }
}

export type VoidResult = { ok: true } | { ok: false; message: string };

export async function voidSaleAction(saleId: string): Promise<VoidResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  try {
    await voidSaleCore(saleId);
    revalidatePath("/register");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "取消に失敗しました。" };
  }
}
