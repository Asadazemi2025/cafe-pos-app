"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, requireCurrentEvent } from "@/lib/event";
import { getStripeClient } from "@/lib/stripe";
import { performSale, type CartLine } from "@/lib/register-sale";
import { prisma } from "@/lib/prisma";

// カード・PayPayの決済は Stripe Checkout(Stripeが用意した決済ページ)で受ける。
// タブレットにQRコードを出し、お客さまが自分のスマホで読み取って支払う方式なので、
// カードリーダーの実機がなくても運用できる。
// 表示される支払い方法(カード/PayPayなど)はStripeダッシュボードの設定に従う。

function originFromHeaders(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export type CreateCheckoutResult =
  | { ok: true; sessionId: string; url: string }
  | { ok: false; message: string };

export async function createCheckoutSession(items: CartLine[]): Promise<CreateCheckoutResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  if (items.length === 0) return { ok: false, message: "カートが空です。" };

  try {
    const eventId = requireCurrentEvent();
    const dayIndex = getCurrentDayIndex();

    // 締め済み・未開店のレジでは会計できない(現金と同じ扱い)
    const session = await prisma.dailyRegister.findUnique({
      where: { eventId_dayIndex: { eventId, dayIndex } },
    });
    if (!session?.openedAt) return { ok: false, message: "先にレジをはじめてください。" };
    if (session.closedAt) return { ok: false, message: "このレジは締め済みです。" };

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map((i) => i.menuItemId) } },
    });

    const lineItems = items.map((line) => {
      const menuItem = menuItems.find((m) => m.id === line.menuItemId);
      if (!menuItem) throw new Error("存在しないメニューが含まれています。");
      return {
        quantity: line.quantity,
        price_data: {
          currency: "jpy",
          // 日本円は小数点以下の桁がないため、unit_amountはそのまま円の整数値
          unit_amount: Math.round(menuItem.salePrice.toNumber()),
          product_data: { name: menuItem.name },
        },
      };
    });

    const origin = originFromHeaders();
    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/pay/done`,
      cancel_url: `${origin}/pay/done?canceled=1`,
      // 支払い方法はStripeダッシュボードの設定にまかせる(カード、PayPay など)
      metadata: { eventId, dayIndex: String(dayIndex) },
    });

    if (!checkout.url) return { ok: false, message: "決済ページの作成に失敗しました。" };
    return { ok: true, sessionId: checkout.id, url: checkout.url };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "決済の準備に失敗しました。" };
  }
}

export type CheckoutStatusResult =
  | { ok: true; paid: boolean; expired: boolean }
  | { ok: false; message: string };

/** レジ側から数秒おきに呼んで、お客さまの支払いが終わったかを見る */
export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatusResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      ok: true,
      paid: session.payment_status === "paid",
      expired: session.status === "expired",
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "状態の確認に失敗しました。" };
  }
}

export type FinalizeCheckoutResult =
  | { ok: true; saleId: string; saleNo: string; method: "CARD" | "PAYPAY" }
  | { ok: false; message: string };

export async function finalizeCheckoutSale(
  sessionId: string,
  items: CartLine[],
): Promise<FinalizeCheckoutResult> {
  try {
    requireEditAuth();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "この操作はできません。" };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });
    if (session.payment_status !== "paid") {
      return { ok: false, message: "まだ支払いが完了していません。" };
    }

    const intent =
      typeof session.payment_intent === "string" ? null : session.payment_intent ?? null;
    const paymentMethod = intent?.payment_method;
    // PayPayはSDKの型定義より新しい支払い方法のため、文字列として見る
    const type: string | null =
      typeof paymentMethod === "string" ? null : (paymentMethod?.type ?? null);
    const method = type === "paypay" ? "PAYPAY" : "CARD";

    const result = await performSale({
      items,
      paymentMethod: method,
      eventId: requireCurrentEvent(),
      dayIndex: getCurrentDayIndex(),
      stripePaymentIntentId: intent?.id ?? null,
      // 同じ決済で二重に売上を作らないための鍵
      clientId: `stripe-${sessionId}`,
    });

    revalidatePath("/register");
    return { ok: true, saleId: result.saleId, saleNo: result.saleNo, method };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "会計の記録に失敗しました。" };
  }
}
