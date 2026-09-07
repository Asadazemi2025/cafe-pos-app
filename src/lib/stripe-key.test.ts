import { describe, expect, it } from "vitest";
import { normalizeStripeSecretKey } from "./stripe-key";

describe("normalizeStripeSecretKey", () => {
  it("keeps a valid Stripe secret key unchanged", () => {
    expect(normalizeStripeSecretKey("sk_test_AbC123")).toBe("sk_test_AbC123");
  });

  it("removes whitespace and surrounding quotes", () => {
    expect(normalizeStripeSecretKey(' "sk_test_Ab C123"\n')).toBe("sk_test_AbC123");
  });

  it("removes invisible Unicode and control characters", () => {
    expect(normalizeStripeSecretKey("sk_test_Ab\u200bC\u0000\u007f123")).toBe(
      "sk_test_AbC123",
    );
  });

  it("rejects a publishable key", () => {
    expect(() => normalizeStripeSecretKey("pk_test_AbC123")).toThrow(
      "STRIPE_SECRET_KEYの形式が不正です",
    );
  });

  it("rejects missing or malformed values without exposing them", () => {
    expect(() => normalizeStripeSecretKey(undefined)).toThrow(
      "STRIPE_SECRET_KEYが設定されていません",
    );
    expect(() => normalizeStripeSecretKey("not-a-stripe-key")).toThrow(
      "STRIPE_SECRET_KEYの形式が不正です",
    );
  });
});
