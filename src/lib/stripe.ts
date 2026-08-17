import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

// 呼び出し時に初めて生成する(STRIPE_SECRET_KEYが未設定の開発初期段階でも
// ビルド・他機能の起動が壊れないようにするため)
export function getStripeClient(): Stripe {
  if (!client) {
    // 環境変数の値はコピペ時に改行・空白が混入しやすい(先頭末尾に限らず途中に
    // 挟まることもある)ため、空白文字はすべて取り除く。混入したままだと
    // HTTPヘッダーとして不正な文字列になりStripeConnectionErrorになる
    const key = process.env.STRIPE_SECRET_KEY?.replace(/\s+/g, "");
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEYが設定されていません。.envにStripeのテストモードAPIキーを設定してください。",
      );
    }
    // Vercelのサーバーレス環境ではfetchベースの既定クライアントが
    // StripeConnectionError(接続エラー)を起こすことがあるため、
    // 従来のNode httpsクライアントを明示的に使う
    client = new Stripe(key, { httpClient: Stripe.createNodeHttpClient() });
  }
  return client;
}
