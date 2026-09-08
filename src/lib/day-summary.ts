import "server-only";
import { prisma } from "@/lib/prisma";

// README「計算ロジック」をそのまま移植したもの。
// ヘッダーのバッジ・レジ・分析・振り返りはすべてここを経由する。

/** 売上0のときに仮置きする変動費率 */
const FALLBACK_VAR_RATE = 0.36;

export type ProductSalesRow = {
  menuItemId: string | null;
  name: string;
  quantity: number;
  sales: number;
  cost: number;
  margin: number;
};

export type DaySummary = {
  eventId: string;
  dayIndex: number;
  days: number;
  /** 当日の売上・原価・粗利 */
  sales: number;
  cost: number;
  margin: number;
  /** 会計件数と点数 */
  saleCount: number;
  unitCount: number;
  /** 1日あたり固定費(イベント全体費用を営業日数で按分して加算) */
  fixedCost: number;
  expenseWholeTotal: number;
  expensePerDayTotal: number;
  /** 変動費率と限界利益率 */
  varRate: number;
  cmRate: number;
  /** 損益分岐点売上 */
  bepSales: number;
  /** 売上 - 分岐点。プラスなら黒字 */
  over: number;
  /** 主力商品(売上1位)で黒字化に必要な個数 */
  unitsToBep: number;
  topProduct: ProductSalesRow | null;
  perProduct: ProductSalesRow[];
  /** 時間帯別売上(10〜16時) */
  byHour: { hour: string; sales: number }[];
};

export const HOURS = ["10", "11", "12", "13", "14", "15", "16"];

export async function getDaySummary(eventId: string, dayIndex: number): Promise<DaySummary> {
  const [event, sales, expenses] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    prisma.sale.findMany({
      where: { eventId, dayIndex, voided: false, isTest: false },
      include: { items: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.expense.findMany({ where: { eventId, isTest: false } }),
  ]);

  const expenseWholeTotal = expenses
    .filter((e) => e.scope === "WHOLE_EVENT")
    .reduce((a, e) => a + e.amount.toNumber(), 0);
  const expensePerDayTotal = expenses
    .filter((e) => e.scope === "PER_DAY")
    .reduce((a, e) => a + e.amount.toNumber(), 0);
  const fixedCost = Math.round(expensePerDayTotal + expenseWholeTotal / Math.max(1, event.days));

  let salesTotal = 0;
  let costTotal = 0;
  let unitCount = 0;
  const perMap = new Map<string, ProductSalesRow>();
  const hourMap = new Map<string, number>();

  for (const sale of sales) {
    salesTotal += sale.totalAmount.toNumber();
    costTotal += sale.totalCost.toNumber();
    unitCount += sale.itemCount;

    const hour = String(
      new Date(sale.occurredAt.getTime() + 9 * 3600 * 1000).getUTCHours(),
    ).padStart(2, "0");
    let saleAmount = 0;

    for (const item of sale.items) {
      const key = item.menuItemId ?? item.name;
      const row =
        perMap.get(key) ??
        ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: 0,
          sales: 0,
          cost: 0,
          margin: 0,
        } satisfies ProductSalesRow);
      const amount = item.amount.toNumber();
      const cost = item.unitCost.toNumber() * item.quantity;
      row.quantity += item.quantity;
      row.sales += amount;
      row.cost += cost;
      row.margin = row.sales - row.cost;
      perMap.set(key, row);
      saleAmount += amount;
    }
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + saleAmount);
  }

  const margin = salesTotal - costTotal;
  const varRate = salesTotal > 0 ? costTotal / salesTotal : FALLBACK_VAR_RATE;
  const cmRate = 1 - varRate;
  const bepSales = cmRate > 0 ? fixedCost / cmRate : 0;
  const over = salesTotal - bepSales;

  const perProduct = [...perMap.values()].sort((a, b) => b.sales - a.sales);
  const topProduct = perProduct[0] ?? null;

  // 主力商品の1個あたり粗利で、黒字までの必要個数を出す
  const topUnitMargin =
    topProduct && topProduct.quantity > 0 ? topProduct.margin / topProduct.quantity : 0;
  const unitsToBep = over >= 0 ? 0 : Math.ceil(-over / Math.max(1, topUnitMargin));

  return {
    eventId,
    dayIndex,
    days: event.days,
    sales: salesTotal,
    cost: costTotal,
    margin,
    saleCount: sales.length,
    unitCount,
    fixedCost,
    expenseWholeTotal,
    expensePerDayTotal,
    varRate,
    cmRate,
    bepSales,
    over,
    unitsToBep,
    topProduct,
    perProduct,
    byHour: HOURS.map((hour) => ({ hour, sales: hourMap.get(hour) ?? 0 })),
  };
}

/** ヘッダーのバッジ文言: 「黒字 +¥12,340」または「黒字まで ¥8,900」 */
export function breakevenBadge(summary: DaySummary): string {
  const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
  return summary.over >= 0
    ? `黒字 +${yen(summary.over)}`
    : `黒字まで ${yen(-summary.over)}`;
}
