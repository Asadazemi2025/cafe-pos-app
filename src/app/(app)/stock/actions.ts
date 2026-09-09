"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { expandRecipeUsage } from "@/lib/cost";
import {
  addMenuStock,
  decrementIngredients,
  getIngredientStockMap,
  getMenuStockMap,
  setMenuStock,
} from "@/lib/event-stock";
import { Prisma } from "@prisma/client";

export type StockState = "ok" | "low" | "out";

export type StockRow = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
  costPrice: number;
  stockMode: "MADE_TO_ORDER" | "PREPARED";
  /** 残数。注文後に作るメニューでレシピ未設定のときはnull(数えられない) */
  stock: number | null;
  /** 基準在庫数(README の par)。未設定なら残数か10で補う */
  par: number;
  /** 残数が材料から自動計算されている(手で増減できない) */
  derived: boolean;
  state: StockState;
};

export type StockSummary = {
  /** 材料+仕込み済みメニューの在庫金額(原価) */
  stockValue: number;
  /** 選択中の営業日に売れた点数と、その原価 */
  soldUnits: number;
  soldCost: number;
  /** 要追加(残りわずか+売切)の品目数 */
  lowCount: number;
};

// 状態判定(README): 残0→売切、残 <= max(2, round(基準×0.25))→要追加
function judge(stock: number | null, par: number): StockState {
  if (stock === null) return "ok";
  if (stock <= 0) return "out";
  return stock <= Math.max(2, Math.round(par * 0.25)) ? "low" : "ok";
}

export async function getStock(): Promise<{ rows: StockRow[]; summary: StockSummary }> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const dayIndex = getCurrentDayIndex();

  // 在庫はイベントごと。ほかのイベントの残りは出さない。
  const [ingredientStocks, menuStocks] = await Promise.all([
    getIngredientStockMap(eventId),
    getMenuStockMap(eventId),
  ]);

  const [items, ingredients, recipes, soldItems] = await Promise.all([
    prisma.menuItem.findMany({ where: { isTest: false }, orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { isTest: false } }),
    prisma.recipeIngredient.findMany(),
    prisma.saleItem.findMany({
      where: { sale: { eventId, dayIndex, voided: false, isTest: false } },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  // 原価はレシピと材料単価から、いま読み込んだデータだけで計算する
  // (メニューごとにDBを引き直すと、そのぶん画面が出るのが遅くなるため)
  const costs = new Map<string, number>();
  for (const line of recipes) {
    const ing = ingredientById.get(line.ingredientId);
    if (!ing) continue;
    costs.set(
      line.menuItemId,
      (costs.get(line.menuItemId) ?? 0) +
        line.quantityPerUnit.toNumber() * ing.costPerUnit.toNumber(),
    );
  }

  const rows: StockRow[] = items.map((item) => {
    const cost = costs.get(item.id) ?? 0;
    let stock: number | null;
    let derived = false;

    if (item.stockMode === "PREPARED") {
      // 仕込み済み: このイベントで「あと何個売れるか」
      stock = menuStocks.get(item.id) ?? 0;
    } else {
      // 注文後に作る: 材料から「あと何個作れるか」を計算する
      derived = true;
      const lines = recipes.filter((r) => r.menuItemId === item.id);
      stock =
        lines.length === 0
          ? null
          : Math.min(
              ...lines.map((line) => {
                const ing = ingredientById.get(line.ingredientId);
                const per = line.quantityPerUnit.toNumber();
                if (!ing || per <= 0) return 0;
                return Math.floor((ingredientStocks.get(line.ingredientId) ?? 0) / per);
              }),
            );
    }

    const par = item.par > 0 ? item.par : Math.max(stock ?? 0, 10);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      salePrice: item.salePrice.toNumber(),
      costPrice: cost,
      stockMode: item.stockMode,
      stock,
      par,
      derived,
      state: judge(stock, par),
    };
  });

  const ingredientValue = ingredients.reduce(
    (sum, i) => sum + (ingredientStocks.get(i.id) ?? 0) * i.costPerUnit.toNumber(),
    0,
  );
  const preparedValue = items
    .filter((i) => i.stockMode === "PREPARED")
    .reduce((sum, i) => sum + (menuStocks.get(i.id) ?? 0) * (costs.get(i.id) ?? 0), 0);

  return {
    rows,
    summary: {
      stockValue: ingredientValue + preparedValue,
      soldUnits: soldItems.reduce((s, i) => s + i.quantity, 0),
      soldCost: soldItems.reduce((s, i) => s + i.unitCost.toNumber() * i.quantity, 0),
      lowCount: rows.filter((r) => r.state !== "ok").length,
    },
  };
}

// 「+1」「+10 追加」= 仕込み。レシピ通りに材料を消費して売れる個数を増やす。
export async function addStock(menuItemId: string, quantity: number): Promise<void> {
  requireEditAuth();
  if (quantity <= 0) throw new Error("追加する個数を入力してください。");
  const eventId = requireCurrentEvent();

  await prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    const usage = await expandRecipeUsage(menuItemId, quantity, tx);

    if (usage.length > 0) {
      const ok = await decrementIngredients(
        tx,
        eventId,
        usage.map((u) => ({ id: u.ingredientId, qty: u.qty })),
      );
      if (!ok) throw new Error("このイベントの材料在庫が足りません。");
    }

    await addMenuStock(eventId, menuItemId, quantity, tx);
    await tx.menuItem.update({ where: { id: menuItemId }, data: { stockMode: "PREPARED" } });
    await tx.menuPreparation.create({
      data: { menuItemId, menuItemName: item.name, quantity },
    });
  });

  revalidatePath("/stock");
  revalidatePath("/register");
  revalidatePath("/ingredients");
}

// 「−1」= 廃棄・数え直し。材料は戻さない。
export async function decrementStock(menuItemId: string): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  const current = (await getMenuStockMap(eventId)).get(menuItemId) ?? 0;
  if (current <= 0) throw new Error("これ以上減らせません。");
  await setMenuStock(eventId, menuItemId, current - 1);
  revalidatePath("/stock");
  revalidatePath("/register");
}

export async function updatePar(menuItemId: string, par: number): Promise<void> {
  requireEditAuth();
  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { par: Math.max(0, Math.round(par)) },
  });
  revalidatePath("/stock");
}

export async function createProduct(input: {
  name: string;
  category: string;
  salePrice: number;
  initialStock: number;
  par: number;
}): Promise<void> {
  requireEditAuth();
  const name = input.name.trim();
  if (!name) throw new Error("商品名を入力してください。");
  if (input.salePrice <= 0) throw new Error("売価を入力してください。");

  const initial = Math.max(0, Math.round(input.initialStock));
  const par = input.par > 0 ? Math.round(input.par) : initial || 10;
  const eventId = requireCurrentEvent();

  const created = await prisma.menuItem.create({
    data: {
      name,
      category: input.category.trim() || null,
      salePrice: new Prisma.Decimal(input.salePrice),
      // 初期在庫を入れた商品は「作り置き」として扱う。
      // 材料は仕込み時にすでに消費済みとみなし、ここでは減らさない。
      stockMode: initial > 0 ? "PREPARED" : "MADE_TO_ORDER",
      par,
    },
  });
  // 初期在庫はいま選んでいるイベントのぶんとして入れる
  if (initial > 0) await addMenuStock(eventId, created.id, initial);
  revalidatePath("/stock");
  revalidatePath("/register");
}

export async function deleteProduct(menuItemId: string): Promise<void> {
  requireEditAuth();
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { menuItemId } }),
    prisma.menuItem.delete({ where: { id: menuItemId } }),
  ]);
  revalidatePath("/stock");
  revalidatePath("/register");
}

export type CarryOverCandidate = { id: string; name: string; dateLabel: string };

/** 在庫を引き継げるイベント(在庫の記録があり、いま選んでいるイベント以外) */
export async function getCarryOverCandidates(): Promise<CarryOverCandidate[]> {
  requireAuth();
  const eventId = requireCurrentEvent();
  const events = await prisma.event.findMany({
    where: {
      id: { not: eventId },
      OR: [{ ingredientStocks: { some: {} } }, { menuStocks: { some: {} } }],
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: { id: true, name: true, date: true },
  });
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    dateLabel: e.date.toISOString().slice(0, 10),
  }));
}

/**
 * ほかのイベントの残り在庫を、いまのイベントに引き継ぐ。
 * 在庫はイベントごとに分かれているので、前回の余りを持ち込むときだけ明示的に実行する。
 * いまのイベントの在庫はこの操作で置き換わる。
 */
export async function carryOverStock(fromEventId: string): Promise<void> {
  requireEditAuth();
  const eventId = requireCurrentEvent();
  if (fromEventId === eventId) throw new Error("同じイベントからは引き継げません。");

  const [ingredientStocks, menuStocks] = await Promise.all([
    prisma.eventIngredientStock.findMany({ where: { eventId: fromEventId } }),
    prisma.eventMenuStock.findMany({ where: { eventId: fromEventId } }),
  ]);

  await prisma.$transaction([
    ...ingredientStocks.map((row) =>
      prisma.eventIngredientStock.upsert({
        where: { eventId_ingredientId: { eventId, ingredientId: row.ingredientId } },
        create: { eventId, ingredientId: row.ingredientId, stock: row.stock },
        update: { stock: row.stock },
      }),
    ),
    ...menuStocks.map((row) =>
      prisma.eventMenuStock.upsert({
        where: { eventId_menuItemId: { eventId, menuItemId: row.menuItemId } },
        create: { eventId, menuItemId: row.menuItemId, preparedStock: row.preparedStock },
        update: { preparedStock: row.preparedStock },
      }),
    ),
  ]);

  revalidatePath("/stock");
  revalidatePath("/register");
}
