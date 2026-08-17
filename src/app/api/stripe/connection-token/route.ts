import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";

// Stripe Terminal SDKが接続に使うConnectionTokenを発行するだけのエンドポイント。
// 信頼できるクライアント(=ログイン済みのこのアプリ)にのみ発行する。
export async function POST() {
  if (getRole() === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();
    const token = await stripe.terminal.connectionTokens.create();
    return NextResponse.json({ secret: token.secret });
  } catch (e) {
    // 原因調査のため、一時的にエラーの詳細(type/code)も返している(後で戻す)
    const detail =
      e && typeof e === "object"
        ? { type: (e as any).type, code: (e as any).code, message: (e as any).message }
        : String(e);
    console.error("connection-token error", detail);
    return NextResponse.json({ error: "接続トークンの発行に失敗しました。", detail }, { status: 500 });
  }
}
