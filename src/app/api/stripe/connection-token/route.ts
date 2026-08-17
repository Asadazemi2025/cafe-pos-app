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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "接続トークンの発行に失敗しました。" },
      { status: 500 },
    );
  }
}
