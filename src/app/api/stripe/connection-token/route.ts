import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";

// Stripe Terminal SDKが接続に使うConnectionTokenを発行するだけのエンドポイント。
// 信頼できるクライアント(=ログイン済みのこのアプリ)にのみ発行する。
export async function POST() {
  if (getRole() === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // --- 一時的な調査用(キーそのものは返さず、文字コードだけ調べる。後で削除する) ---
  const raw = process.env.STRIPE_SECRET_KEY ?? "";
  const bad: { index: number; code: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (!/[A-Za-z0-9_]/.test(raw[i])) bad.push({ index: i, code: raw.charCodeAt(i) });
  }
  const diagnostic = { length: raw.length, startsWithSk: raw.startsWith("sk_"), badChars: bad };
  // --- 調査用ここまで ---

  try {
    const stripe = getStripeClient();
    const token = await stripe.terminal.connectionTokens.create();
    return NextResponse.json({ secret: token.secret });
  } catch (e) {
    console.error("connection-token error", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "接続トークンの発行に失敗しました。",
        diagnostic,
      },
      { status: 500 },
    );
  }
}
