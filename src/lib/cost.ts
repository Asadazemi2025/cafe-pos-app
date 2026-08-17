import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@prisma/client";

export type IngredientUsageLine = {
  ingredientId: string;
  ingredientName: string;
  qty: number;
};

type Db = PrismaClient | Prisma.TransactionClient;

// レシピ(材料×消費量)から、メニュー1点あたりの原価を都度計算する。
// 保存はしない — メニュー数は多くないため、キャッシュの整合性管理より正確さを優先する。
export async function computeMenuItemCost(menuItemId: string, db: Db = prisma): Promise<Prisma.Decimal> {
  const recipe = await db.recipeIngredient.findMany({
    where: { menuItemId },
    include: { ingredient: true },
  });
  return recipe.reduce(
    (sum, line) => sum.add(line.quantityPerUnit.mul(line.ingredient.costPerUnit)),
    new Prisma.Decimal(0),
  );
}

// 複数メニューの原価を一括計算する(一覧画面用)
export async function computeMenuItemCosts(
  menuItemIds: string[],
): Promise<Record<string, Prisma.Decimal>> {
  const recipe = await prisma.recipeIngredient.findMany({
    where: { menuItemId: { in: menuItemIds } },
    include: { ingredient: true },
  });
  const result: Record<string, Prisma.Decimal> = {};
  for (const id of menuItemIds) result[id] = new Prisma.Decimal(0);
  for (const line of recipe) {
    result[line.menuItemId] = result[line.menuItemId].add(
      line.quantityPerUnit.mul(line.ingredient.costPerUnit),
    );
  }
  return result;
}

// レジでの会計時に使う: レシピを実際の消費量に展開する(スナップショット用)
export async function expandRecipeUsage(
  menuItemId: string,
  quantity: number,
  db: Db = prisma,
): Promise<IngredientUsageLine[]> {
  const recipe = await db.recipeIngredient.findMany({
    where: { menuItemId },
    include: { ingredient: true },
  });
  return recipe.map((line) => ({
    ingredientId: line.ingredientId,
    ingredientName: line.ingredient.name,
    qty: line.quantityPerUnit.mul(quantity).toNumber(),
  }));
}
