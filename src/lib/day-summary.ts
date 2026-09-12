import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getTestMode } from "@/lib/app-mode";

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

/** 何も売れていないときに出す既定の時間帯 */
export const HOURS = ["10", "11", "12", "13", "14", "15", "16"];

/** 会計のJST時刻の「時」を2桁で返す */
function jstHour(at: Date): string {
  return String(new Date(at.getTime() + 9 * 3600 * 1000).getUTCHours()).padStart(2, "0");
}

type SaleRow = {
  dayIndex: number;
  occurredAt: Date;
  totalAmount: number;
  totalCost: number;
  itemCount: number;
  items: { menuItemId: string | null; name: string; quantity: number; amount: number; unitCost: number }[];
};

type EventData = {
  id: string;
  days: number;
  /** 表示する時間帯。既定の10〜16時に、実際に会計のあった時間を足したもの */
  hours: string[];
  sales: SaleRow[];
  expenseWholeTotal: number;
  expensePerDayTotal: number;
};

// イベント1件ぶんのデータを1往復で読み、同じリクエスト内では使い回す。
// (ヘッダーのバッジ・ページ本体・分析が同じ集計を何度も取りにいくのを防ぐ)
const loadEventData = cache(async (eventId: string): Promise<EventData> => {
  // テストモード中はテスト用の売上・経費だけを見る(本番の数字と混ぜない)
  const isTest = await getTestMode();
  const [event, sales, expenses] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { id: true, days: true } }),
    prisma.sale.findMany({
      where: { eventId, voided: false, isTest },
      orderBy: { occurredAt: "asc" },
      select: {
        dayIndex: true,
        occurredAt: true,
        totalAmount: true,
        totalCost: true,
        itemCount: true,
        items: {
          select: { menuItemId: true, name: true, quantity: true, amount: true, unitCost: true },
        },
      },
    }),
    prisma.expense.findMany({
      where: { eventId, isTest },
      select: { scope: true, amount: true },
    }),
  ]);

  // 早朝や夜に会計があっても表から消えないよう、実績のある時間帯を足しておく。
  // (10〜16時に固定していると、その外の売上が時間帯別グラフに出ないまま
  //  日合計だけが増えて、数字が合わないように見えてしまう)
  const hours = [...new Set([...HOURS, ...sales.map((s) => jstHour(s.occurredAt))])].sort();

  return {
    id: event.id,
    days: event.days,
    hours,
    sales: sales.map((s) => ({
      dayIndex: s.dayIndex,
      occurredAt: s.occurredAt,
      totalAmount: s.totalAmount.toNumber(),
      totalCost: s.totalCost.toNumber(),
      itemCount: s.itemCount,
      items: s.items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        quantity: i.quantity,
        amount: i.amount.toNumber(),
        unitCost: i.unitCost.toNumber(),
      })),
    })),
    expenseWholeTotal: expenses
      .filter((e) => e.scope === "WHOLE_EVENT")
      .reduce((a, e) => a + e.amount.toNumber(), 0),
    expensePerDayTotal: expenses
      .filter((e) => e.scope === "PER_DAY")
      .reduce((a, e) => a + e.amount.toNumber(), 0),
  };
});

function summarize(data: EventData, dayIndex: number): DaySummary {
  const fixedCost = Math.round(
    data.expensePerDayTotal + data.expenseWholeTotal / Math.max(1, data.days),
  );

  let salesTotal = 0;
  let costTotal = 0;
  let unitCount = 0;
  let saleCount = 0;
  const perMap = new Map<string, ProductSalesRow>();
  const hourMap = new Map<string, number>();

  for (const sale of data.sales) {
    if (sale.dayIndex !== dayIndex) continue;
    saleCount += 1;
    salesTotal += sale.totalAmount;
    costTotal += sale.totalCost;
    unitCount += sale.itemCount;

    const hour = jstHour(sale.occurredAt);
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
      row.quantity += item.quantity;
      row.sales += item.amount;
      row.cost += item.unitCost * item.quantity;
      row.margin = row.sales - row.cost;
      perMap.set(key, row);
      saleAmount += item.amount;
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
    eventId: data.id,
    dayIndex,
    days: data.days,
    sales: salesTotal,
    cost: costTotal,
    margin,
    saleCount,
    unitCount,
    fixedCost,
    expenseWholeTotal: data.expenseWholeTotal,
    expensePerDayTotal: data.expensePerDayTotal,
    varRate,
    cmRate,
    bepSales,
    over,
    unitsToBep,
    topProduct,
    perProduct,
    byHour: data.hours.map((hour) => ({ hour, sales: hourMap.get(hour) ?? 0 })),
  };
}

export async function getDaySummary(eventId: string, dayIndex: number): Promise<DaySummary> {
  return summarize(await loadEventData(eventId), dayIndex);
}

/** 分析のヒートマップ用。全営業日ぶんをまとめて返す(追加のDBアクセスは発生しない) */
export async function getAllDaySummaries(eventId: string): Promise<DaySummary[]> {
  const data = await loadEventData(eventId);
  return Array.from({ length: Math.max(1, data.days) }, (_, i) => summarize(data, i));
}

/** ヘッダーのバッジ文言: 「黒字 +¥12,340」または「黒字まで ¥8,900」 */
export function breakevenBadge(summary: DaySummary): string {
  const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
  return summary.over >= 0
    ? `黒字 +${yen(summary.over)}`
    : `黒字まで ${yen(-summary.over)}`;
}
