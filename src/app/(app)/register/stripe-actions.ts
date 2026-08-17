"use server";

import { revalidatePath } from "next/cache";
import { requireEditAuth } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";
import { performSale, type CartLine } from "@/lib/register-sale";
import { prisma } from "@/lib/prisma";

export type CreatePaymentIntentResult =
  | { ok: true; clientSecret: string; paymentIntentId: string }
  | { ok: false; message: string };

export async function createCardPaymentIntent(
  items: CartLine[],
): Promise<CreatePaymentIntentResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  if (items.length === 0) return { ok: false, message: "カートが空です。" };

  try {
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map((i) => i.menuItemId) } },
    });
    let amount = 0;
    for (const line of items) {
      const menuItem = menuItems.find((m) => m.id === line.menuItemId);
      if (!menuItem) return { ok: false, message: "存在しないメニューが含まれています。" };
      amount += menuItem.salePrice.toNumber() * line.quantity;
    }

    const stripe = getStripeClient();
    // 日本円は小数点以下の桁がないため、amountはそのまま円の整数値
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "jpy",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
    });

    return { ok: true, clientSecret: intent.client_secret!, paymentIntentId: intent.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "決済の準備に失敗しました。" };
  }
}

export type FinalizeCardSaleResult = { ok: true; saleId: string } | { ok: false; message: string };

export async function finalizeCardSale(
  paymentIntentId: string,
  items: CartLine[],
): Promise<FinalizeCardSaleResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  try {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return { ok: false, message: "カード決済が完了していません。" };
    }

    const result = await performSale({
      items,
      paymentMethod: "CARD",
      stripePaymentIntentId: paymentIntentId,
      clientId: `stripe-${paymentIntentId}`,
    });
    revalidatePath("/register");
    return { ok: true, saleId: result.saleId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "会計の記録に失敗しました。" };
  }
}
