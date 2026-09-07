const STRIPE_SECRET_KEY_PATTERN = /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/;

/**
 * Copy/paste can add quotes, control characters, or invisible Unicode characters
 * to a Vercel environment variable. Stripe places this value in an Authorization
 * header, so those characters fail before the request reaches Stripe.
 */
export function normalizeStripeSecretKey(rawKey: string | undefined): string {
  if (!rawKey) {
    throw new Error(
      "STRIPE_SECRET_KEYが設定されていません。VercelにStripeの秘密鍵を設定してください。",
    );
  }

  // Stripe API keys only contain ASCII letters, numbers, and underscores.
  // Allow-listing those characters also removes zero-width and control characters
  // that JavaScript's whitespace character class does not cover.
  const key = rawKey.replace(/[^A-Za-z0-9_]/g, "");

  if (!STRIPE_SECRET_KEY_PATTERN.test(key)) {
    throw new Error(
      "STRIPE_SECRET_KEYの形式が不正です。Vercelにsk_test_またはsk_live_で始まるStripeの秘密鍵を設定してください。",
    );
  }

  return key;
}
