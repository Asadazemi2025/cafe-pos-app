"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMenuItemCosts, expandRecipeUsage } from "@/lib/cost";
import { requireCurrentEvent } from "@/lib/event";
import { addMenuStock, decrementIngredients, getMenuStockMap, setMenuStock } from "@/lib/event-stock";
import { Prisma } from "@prisma/client";

export type MenuStockModeDTO = "MADE_TO_ORDER" | "PREPARED";

export type MenuItemDTO = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
  costPrice: number;
  showInRegister: boolean;
  stockMode: MenuStockModeDTO;
  preparedStock: number;
};

export async function getMenuItems(): Promise<MenuItemDTO[]> {
  requireAuth();
  // 仕込み済みの残数はイベントごと
  const menuStocks = await getMenuStockMap(requireCurrentEvent());
  const items = await prisma.menuItem.findMany({
    orderBy: { name: "asc" },
    where: { isTest: false },
  });
  const costs = await computeMenuItemCosts(items.map((i) => i.id));
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    salePrice: i.salePrice.toNumber(),
    costPrice: costs[i.id].toNumber(),
    showInRegister: i.showInRegister,
    stockMode: i.stockMode,
    preparedStock: menuStocks.get(i.id) ?? 0,
  }));
}

export type RecipeLineDTO = {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityPerUnit: number;
};

export async function getMenuItemRecipe(menuItemId: string): Promise<RecipeLineDTO[]> {
  requireAuth();
  const lines = await prisma.recipeIngredient.findMany({
    where: { menuItemId },
    include: { ingredient: true },
  });
  return lines.map((l) => ({
    ingredientId: l.ingredientId,
    ingredientName: l.ingredient.name,
    unit: l.ingredient.unit,
    quantityPerUnit: l.quantityPerUnit.toNumber(),
  }));
}

export type IngredientOptionDTO = { id: string; name: string; unit: string; costPerUnit: number };

export async function getIngredientOptions(): Promise<IngredientOptionDTO[]> {
  requireAuth();
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    where: { isTest: false },
  });
  return ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    costPerUnit: i.costPerUnit.toNumber(),
  }));
}

export async function createMenuItem(input: {
  name: string;
  category?: string;
  salePrice: number;
  showInRegister: boolean;
}): Promise<string> {
  requireEditAuth();
  if (!input.name.trim()) throw new Error("メニュー名を入力してください。");
  if (input.salePrice < 0) throw new Error("販売価格を入力してください。");

  const created = await prisma.menuItem.create({
    data: {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      salePrice: new Prisma.Decimal(input.salePrice),
      showInRegister: input.showInRegister,
    },
  });
  revalidatePath("/menu-items");
  return created.id;
}

export async function updateMenuItem(input: {
  id: string;
  name: string;
  category?: string;
  salePrice: number;
  showInRegister: boolean;
}): Promise<void> {
  requireEditAuth();
  await prisma.menuItem.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      salePrice: new Prisma.Decimal(input.salePrice),
      showInRegister: input.showInRegister,
    },
  });
  revalidatePath("/menu-items");
}

// レシピを丸ごと置き換える(削除→再作成)。編集画面は「今の完成形」を送るだけでよいシンプルな設計。
export async function saveRecipe(
  menuItemId: string,
  lines: { ingredientId: string; quantityPerUnit: number }[],
): Promise<void> {
  requireEditAuth();
  const cleaned = lines.filter((l) => l.ingredientId && l.quantityPerUnit > 0);

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { menuItemId } }),
    ...(cleaned.length
      ? [
          prisma.recipeIngredient.createMany({
            data: cleaned.map((l) => ({
              menuItemId,
              ingredientId: l.ingredientId,
              quantityPerUnit: new Prisma.Decimal(l.quantityPerUnit),
            })),
          }),
        ]
      : []),
  ]);
  revalidatePath("/menu-items");
}

export async function setStockMode(
  menuItemId: string,
  stockMode: MenuStockModeDTO,
): Promise<void> {
  requireEditAuth();
  await prisma.menuItem.update({ where: { id: menuItemId }, data: { stockMode } });
  revalidatePath("/menu-items");
  revalidatePath("/register");
}

// 仕込み(作り置き)の記録。レシピ通りに材料を消費して、売れる個数を増やす。
export async function recordPreparation(menuItemId: string, quantity: number): Promise<void> {
  requireEditAuth();
  if (quantity <= 0) throw new Error("作った個数を入力してください。");

  const eventId = requireCurrentEvent();

  await prisma.$transaction(async (tx) => {
    const menuItem = await tx.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });

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
    await tx.menuItem.update({
      where: { id: menuItemId },
      // 仕込みを記録した時点で「作り置き」の運用に切り替える
      data: { stockMode: "PREPARED" },
    });

    await tx.menuPreparation.create({
      data: { menuItemId, menuItemName: menuItem.name, quantity },
    });
  });

  revalidatePath("/menu-items");
  revalidatePath("/register");
  revalidatePath("/ingredients");
}

// 数え間違いなどの手直し用。材料には影響させない。
export async function setPreparedStock(menuItemId: string, nextStock: number): Promise<void> {
  requireEditAuth();
  if (nextStock < 0) throw new Error("0以上の個数を入力してください。");
  await setMenuStock(requireCurrentEvent(), menuItemId, Math.round(nextStock));
  revalidatePath("/menu-items");
  revalidatePath("/register");
}

export async function deleteMenuItem(id: string): Promise<void> {
  requireEditAuth();
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { menuItemId: id } }),
    prisma.menuItem.delete({ where: { id } }),
  ]);
  revalidatePath("/menu-items");
}
