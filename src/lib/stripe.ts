import "server-only";
import Stripe from "stripe";
import { normalizeStripeSecretKey } from "@/lib/stripe-key";

let client: Stripe | undefined;

// 呼び出し時に初めて生成する(STRIPE_SECRET_KEYが未設定の開発初期段階でも
// ビルド・他機能の起動が壊れないようにするため)
export function getStripeClient(): Stripe {
  if (!client) {
    const key = normalizeStripeSecretKey(process.env.STRIPE_SECRET_KEY);
    // Vercelのサーバーレス環境ではfetchベースの既定クライアントが
    // StripeConnectionError(接続エラー)を起こすことがあるため、
    // 従来のNode httpsクライアントを明示的に使う
    client = new Stripe(key, { httpClient: Stripe.createNodeHttpClient() });
  }
  return client;
}
