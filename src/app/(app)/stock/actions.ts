"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, requireCurrentEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { computeMenuItemCosts, expandRecipeUsage } from "@/lib/cost";
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

  const [items, ingredients, recipes, soldItems] = await Promise.all([
    prisma.menuItem.findMany({ where: { isTest: false }, orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { isTest: false } }),
    prisma.recipeIngredient.findMany(),
    prisma.saleItem.findMany({
      where: { sale: { eventId, dayIndex, voided: false, isTest: false } },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const costs = await computeMenuItemCosts(items.map((i) => i.id));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const rows: StockRow[] = items.map((item) => {
    const cost = costs[item.id].toNumber();
    let stock: number | null;
    let derived = false;

    if (item.stockMode === "PREPARED") {
      // 仕込み済み: 「あと何個売れるか」をそのまま残数にする
      stock = item.preparedStock;
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
                return Math.floor(ing.stock.toNumber() / per);
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
    (sum, i) => sum + i.stock.toNumber() * i.costPerUnit.toNumber(),
    0,
  );
  const preparedValue = items
    .filter((i) => i.stockMode === "PREPARED")
    .reduce((sum, i) => sum + i.preparedStock * costs[i.id].toNumber(), 0);

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

  await prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    const usage = await expandRecipeUsage(menuItemId, quantity, tx);

    if (usage.length > 0) {
      const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        UPDATE "Ingredient" AS i
        SET stock = i.stock - v.qty
        FROM (VALUES ${Prisma.join(
          usage.map((u) => Prisma.sql`(${u.ingredientId}::text, ${u.qty}::numeric)`),
        )}) AS v(id, qty)
        WHERE i.id = v.id AND i.stock >= v.qty
        RETURNING i.id
      `);
      if (updated.length !== usage.length) throw new Error("材料の在庫が足りません。");
    }

    await tx.menuItem.update({
      where: { id: menuItemId },
      data: { preparedStock: { increment: quantity }, stockMode: "PREPARED" },
    });
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
  const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
  if (item.preparedStock <= 0) throw new Error("これ以上減らせません。");
  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { preparedStock: { decrement: 1 } },
  });
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

  await prisma.menuItem.create({
    data: {
      name,
      category: input.category.trim() || null,
      salePrice: new Prisma.Decimal(input.salePrice),
      // 初期在庫を入れた商品は「作り置き」として扱う。
      // 材料は仕込み時に消費済みとみなし、ここでは減らさない。
      stockMode: initial > 0 ? "PREPARED" : "MADE_TO_ORDER",
      preparedStock: initial,
      par,
    },
  });
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
