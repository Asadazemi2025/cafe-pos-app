export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1] as const;

export type CashCounts = Partial<Record<(typeof DENOMINATIONS)[number], number>>;

export function sumCashCounts(counts: CashCounts): number {
  return DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] ?? 0), 0);
}
