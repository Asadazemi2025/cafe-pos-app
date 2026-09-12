import "server-only";
import Stripe from "stripe";
import { normalizeStripeSecretKey } from "@/lib/stripe-key";
import { getTestMode } from "@/lib/app-mode";

// テストモードと本番モードで使うキーを分ける。
//   テスト → STRIPE_SECRET_KEY_TEST (sk_test_... 実際のお金は動かない)
//   本番   → STRIPE_SECRET_KEY_LIVE (sk_live_... 実際に決済される)
// 片方しか用意していない場合は STRIPE_SECRET_KEY を使う(これまでの設定のまま動く)。

const clients = new Map<string, Stripe>();

function keyFor(testMode: boolean): string {
  const specific = testMode
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;
  return normalizeStripeSecretKey(specific || process.env.STRIPE_SECRET_KEY);
}

/** いまのモードに合ったStripeクライアントを返す */
export async function getStripeClient(): Promise<Stripe> {
  return getStripeClientFor(await getTestMode());
}

export function getStripeClientFor(testMode: boolean): Stripe {
  const cacheKey = testMode ? "test" : "live";
  const cached = clients.get(cacheKey);
  if (cached) return cached;

  const key = keyFor(testMode);
  // Vercelのサーバーレス環境ではfetchベースの既定クライアントが
  // StripeConnectionError(接続エラー)を起こすことがあるため、
  // 従来のNode httpsクライアントを明示的に使う
  const client = new Stripe(key, { httpClient: Stripe.createNodeHttpClient() });
  clients.set(cacheKey, client);
  return client;
}

/**
 * いま使っているキーが本物(sk_live_)かどうか。
 * 「実際に決済されます/テスト決済です」の表示に使う。
 */
export async function isLiveStripeKey(): Promise<boolean> {
  try {
    return keyFor(await getTestMode()).startsWith("sk_live_");
  } catch {
    return false;
  }
}
