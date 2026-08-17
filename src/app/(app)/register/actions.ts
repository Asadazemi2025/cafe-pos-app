"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { performSale, voidSale as voidSaleCore, type CartLine } from "@/lib/register-sale";

export type RegisterMenuItemDTO = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
};

export async function getRegisterMenu(): Promise<RegisterMenuItemDTO[]> {
  requireAuth();
  const items = await prisma.menuItem.findMany({
    where: { showInRegister: true, isTest: false },
    orderBy: { name: "asc" },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    salePrice: i.salePrice.toNumber(),
  }));
}

export type RecentSaleDTO = {
  id: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: "CASH" | "CARD";
  voided: boolean;
  occurredAt: string;
};

export async function getRecentSales(): Promise<RecentSaleDTO[]> {
  requireAuth();
  const sales = await prisma.sale.findMany({
    where: { isTest: false },
    orderBy: { occurredAt: "desc" },
    take: 15,
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
  | { ok: true; saleId: string; duplicate: boolean }
  | { ok: false; message: string };

export async function checkout(input: {
  items: CartLine[];
  clientId?: string;
}): Promise<CheckoutResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  try {
    const result = await performSale({
      items: input.items,
      paymentMethod: "CASH",
      clientId: input.clientId ?? null,
    });
    revalidatePath("/register");
    return { ok: true, saleId: result.saleId, duplicate: result.duplicate };
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
