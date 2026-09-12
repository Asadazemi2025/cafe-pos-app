import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getTestMode } from "@/lib/app-mode";

// 管理会計の計算をまとめたところ。
// 「毎日いくらの利益が必要か」「その利益を出すにはどう売るか」
// 「時間(人手)が足りないとき何を売るのが得か」「何と何が一緒に売れているか」を出す。

export type ProductEconomics = {
  id: string;
  name: string;
  category: string;
  price: number;
  unitCost: number;
  /** 1個あたりの粗利(限界利益) */
  unitMargin: number;
  marginRate: number;
  /** 1個を作って渡すまでの時間(分)。0なら未設定 */
  prepMinutes: number;
  /** 制約1単位(1分)あたりの粗利。提供時間が未設定ならnull */
  marginPerMinute: number | null;
  /** 実績(イベント全体) */
  soldQty: number;
  soldSales: number;
  soldMargin: number;
  /** 売上構成比(0〜1) */
  share: number;
};

export type RequiredMixRow = {
  id: string;
  name: string;
  share: number;
  price: number;
  unitMargin: number;
  /** 今の売れ方のまま必要利益に届かせるための1日あたり販売数 */
  requiredQtyPerDay: number;
  /** 実績の1日あたり平均販売数 */
  actualQtyPerDay: number;
  gap: number;
};

export type CategoryLink = {
  category: string;
  /** この区分を含む会計の件数 */
  saleCount: number;
  /** 含む会計の平均客単価 */
  avgWith: number;
  /** 含まない会計の平均客単価 */
  avgWithout: number;
  /** 客単価の差(円)。プラスなら、この区分が客単価を押し上げている */
  uplift: number;
  /** 他区分への併売率: この区分を買った会計のうち、相手も買った割合 */
  attach: { category: string; rate: number; lift: number }[];
};

export type PairRow = { a: string; b: string; count: number; rate: number };

export type ManagerialData = {
  /** 損益分岐点まわり(選択中の営業日) */
  fixedPerDay: number;
  dailyProfitTarget: number;
  /** 固定費+目標利益 = 毎日必要な粗利 */
  requiredMarginPerDay: number;
  cmRate: number;
  requiredSalesPerDay: number;
  /** 実績(選択中の営業日) */
  todaySales: number;
  todayMargin: number;
  todayUnits: number;
  todayCustomers: number;
  /** 2品以上入っていた会計の割合(併売率)。選択中の営業日 */
  todayAttachRate: number;
  /** 必要な客数(実績の客単価で割ったもの) */
  avgTicket: number;
  requiredCustomers: number;
  /** 何日目までの実績が入っているか */
  businessDaysWithSales: number;
  requiredMix: RequiredMixRow[];
  products: ProductEconomics[];
  /** 1日に使える提供時間(分) = 営業時間 × 人数 */
  capacityMinutes: number;
  serviceHours: number;
  staffCount: number;
  categories: CategoryLink[];
  pairs: PairRow[];
  totalSaleCount: number;
};

const UNCATEGORIZED = "その他";

export const getProfitPlan = cache(async (eventId: string) => {
  const plan = await prisma.profitPlan.findUnique({ where: { eventId } });
  return {
    dailyProfitTarget: plan?.dailyProfitTarget.toNumber() ?? 0,
    serviceHours: plan?.serviceHours.toNumber() ?? 6,
    staffCount: plan?.staffCount ?? 2,
    memo: plan?.memo ?? "",
  };
});

export async function getManagerialData(
  eventId: string,
  dayIndex: number,
): Promise<ManagerialData> {
  const isTest = await getTestMode();
  const [event, plan, menuItems, recipes, sales, expenses] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { days: true } }),
    getProfitPlan(eventId),
    prisma.menuItem.findMany({ where: { isTest: false } }),
    prisma.recipeIngredient.findMany({
      select: {
        menuItemId: true,
        quantityPerUnit: true,
        ingredient: { select: { costPerUnit: true } },
      },
    }),
    prisma.sale.findMany({
      where: { eventId, voided: false, isTest },
      select: {
        dayIndex: true,
        totalAmount: true,
        items: {
          select: { menuItemId: true, name: true, quantity: true, amount: true, unitCost: true },
        },
      },
    }),
    prisma.expense.findMany({ where: { eventId, isTest }, select: { scope: true, amount: true } }),
  ]);

  // ---- 固定費(1日あたり) ----
  const wholeTotal = expenses
    .filter((e) => e.scope === "WHOLE_EVENT")
    .reduce((a, e) => a + e.amount.toNumber(), 0);
  const perDayTotal = expenses
    .filter((e) => e.scope === "PER_DAY")
    .reduce((a, e) => a + e.amount.toNumber(), 0);
  const fixedPerDay = Math.round(perDayTotal + wholeTotal / Math.max(1, event.days));

  // ---- メニューマスタの原価 ----
  const unitCostById = new Map<string, number>();
  for (const line of recipes) {
    unitCostById.set(
      line.menuItemId,
      (unitCostById.get(line.menuItemId) ?? 0) +
        line.quantityPerUnit.toNumber() * line.ingredient.costPerUnit.toNumber(),
    );
  }

  // ---- 実績の集計 ----
  type Agg = { qty: number; sales: number; margin: number };
  const aggById = new Map<string, Agg>();
  const daysSeen = new Set<number>();
  let eventSales = 0;
  let eventMargin = 0;
  let todaySales = 0;
  let todayMargin = 0;
  let todayCount = 0;
  let todayUnits = 0;
  let todayMultiItem = 0;

  // 併売分析用: 1会計ごとの「買われた区分」「買われた商品」
  const basketCategories: { set: Set<string>; amount: number }[] = [];
  const basketProducts: Set<string>[] = [];
  const categoryOf = new Map<string, string>(
    menuItems.map((m) => [m.id, m.category?.trim() || UNCATEGORIZED]),
  );

  for (const sale of sales) {
    const amount = sale.totalAmount.toNumber();
    let margin = 0;
    const cats = new Set<string>();
    const names = new Set<string>();

    for (const item of sale.items) {
      const itemSales = item.amount.toNumber();
      const itemCost = item.unitCost.toNumber() * item.quantity;
      margin += itemSales - itemCost;

      const key = item.menuItemId ?? item.name;
      const agg = aggById.get(key) ?? { qty: 0, sales: 0, margin: 0 };
      agg.qty += item.quantity;
      agg.sales += itemSales;
      agg.margin += itemSales - itemCost;
      aggById.set(key, agg);

      cats.add((item.menuItemId && categoryOf.get(item.menuItemId)) || UNCATEGORIZED);
      names.add(item.name);
    }

    eventSales += amount;
    eventMargin += margin;
    if (amount > 0) daysSeen.add(sale.dayIndex);
    if (sale.dayIndex === dayIndex) {
      todaySales += amount;
      todayMargin += margin;
      todayCount += 1;
      const units = sale.items.reduce((a, i) => a + i.quantity, 0);
      todayUnits += units;
      if (units >= 2) todayMultiItem += 1;
    }

    basketCategories.push({ set: cats, amount });
    basketProducts.push(names);
  }

  // ---- 商品ごとの採算 ----
  const products: ProductEconomics[] = menuItems
    .map((m) => {
      const price = m.salePrice.toNumber();
      const unitCost = unitCostById.get(m.id) ?? 0;
      const unitMargin = price - unitCost;
      const prepMinutes = m.prepMinutes.toNumber();
      const agg = aggById.get(m.id) ?? { qty: 0, sales: 0, margin: 0 };
      return {
        id: m.id,
        name: m.name,
        category: m.category?.trim() || UNCATEGORIZED,
        price,
        unitCost,
        unitMargin,
        marginRate: price > 0 ? unitMargin / price : 0,
        prepMinutes,
        marginPerMinute: prepMinutes > 0 ? unitMargin / prepMinutes : null,
        soldQty: agg.qty,
        soldSales: agg.sales,
        soldMargin: agg.margin,
        share: eventSales > 0 ? agg.sales / eventSales : 0,
      };
    })
    .sort((a, b) => b.soldSales - a.soldSales);

  // ---- 毎日必要な利益と、その売上構成 ----
  const dailyProfitTarget = plan.dailyProfitTarget;
  const requiredMarginPerDay = fixedPerDay + dailyProfitTarget;
  // 限界利益率は実績から。実績がなければメニューの平均で代用する
  const masterCmRate =
    products.length > 0
      ? products.reduce((a, p) => a + p.marginRate, 0) / products.length
      : 0.6;
  const cmRate = eventSales > 0 ? eventMargin / eventSales : masterCmRate;
  const requiredSalesPerDay = cmRate > 0 ? requiredMarginPerDay / cmRate : 0;

  const businessDaysWithSales = Math.max(1, daysSeen.size);
  const soldProducts = products.filter((p) => p.soldQty > 0);
  // 売れている商品があればその構成比、なければメニューを均等に置く
  const mixBase =
    soldProducts.length > 0
      ? soldProducts
      : products.slice(0, 8).map((p) => ({ ...p, share: 1 / Math.max(1, Math.min(8, products.length)) }));

  const requiredMix: RequiredMixRow[] = mixBase.map((p) => {
    const requiredQtyPerDay = p.price > 0 ? (requiredSalesPerDay * p.share) / p.price : 0;
    const actualQtyPerDay = p.soldQty / businessDaysWithSales;
    return {
      id: p.id,
      name: p.name,
      share: p.share,
      price: p.price,
      unitMargin: p.unitMargin,
      requiredQtyPerDay,
      actualQtyPerDay,
      gap: actualQtyPerDay - requiredQtyPerDay,
    };
  });

  const avgTicket = todayCount > 0 ? todaySales / todayCount : eventSales > 0 && sales.length > 0 ? eventSales / sales.length : 0;
  const requiredCustomers = avgTicket > 0 ? requiredSalesPerDay / avgTicket : 0;

  // ---- 併売分析 ----
  const totalSaleCount = basketCategories.length;
  const catNames = [...new Set(menuItems.map((m) => m.category?.trim() || UNCATEGORIZED))];

  const countWith = new Map<string, number>();
  const sumWith = new Map<string, number>();
  for (const basket of basketCategories) {
    for (const c of basket.set) {
      countWith.set(c, (countWith.get(c) ?? 0) + 1);
      sumWith.set(c, (sumWith.get(c) ?? 0) + basket.amount);
    }
  }

  const categories: CategoryLink[] = catNames
    .map((c) => {
      const withCount = countWith.get(c) ?? 0;
      const withoutCount = totalSaleCount - withCount;
      const withSum = sumWith.get(c) ?? 0;
      const withoutSum = eventSales - withSum;
      const avgWith = withCount > 0 ? withSum / withCount : 0;
      const avgWithout = withoutCount > 0 ? withoutSum / withoutCount : 0;

      const attach = catNames
        .filter((other) => other !== c)
        .map((other) => {
          const both = basketCategories.filter((b) => b.set.has(c) && b.set.has(other)).length;
          const rate = withCount > 0 ? both / withCount : 0;
          const pA = totalSaleCount > 0 ? withCount / totalSaleCount : 0;
          const pB = totalSaleCount > 0 ? (countWith.get(other) ?? 0) / totalSaleCount : 0;
          const pBoth = totalSaleCount > 0 ? both / totalSaleCount : 0;
          return { category: other, rate, lift: pA * pB > 0 ? pBoth / (pA * pB) : 0 };
        })
        .sort((a, b) => b.rate - a.rate);

      return { category: c, saleCount: withCount, avgWith, avgWithout, uplift: avgWith - avgWithout, attach };
    })
    .filter((c) => c.saleCount > 0)
    .sort((a, b) => b.saleCount - a.saleCount);

  // 商品ペアの上位(同じ会計に入っていた回数)
  const pairCount = new Map<string, number>();
  for (const names of basketProducts) {
    const list = [...names].sort();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]} ${list[j]}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }
  const pairs: PairRow[] = [...pairCount.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split(" ");
      return { a, b, count, rate: totalSaleCount > 0 ? count / totalSaleCount : 0 };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, 8);

  return {
    fixedPerDay,
    dailyProfitTarget,
    requiredMarginPerDay,
    cmRate,
    requiredSalesPerDay,
    todaySales,
    todayMargin,
    todayUnits,
    todayCustomers: todayCount,
    todayAttachRate: todayCount > 0 ? todayMultiItem / todayCount : 0,
    avgTicket,
    requiredCustomers,
    businessDaysWithSales,
    requiredMix,
    products,
    capacityMinutes: Math.round(plan.serviceHours * 60 * plan.staffCount),
    serviceHours: plan.serviceHours,
    staffCount: plan.staffCount,
    categories,
    pairs,
    totalSaleCount,
  };
}
