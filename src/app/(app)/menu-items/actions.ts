"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMenuItemCosts } from "@/lib/cost";
import { Prisma } from "@prisma/client";

export type MenuItemDTO = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
  costPrice: number;
  showInRegister: boolean;
};

export async function getMenuItems(): Promise<MenuItemDTO[]> {
  requireAuth();
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

export async function deleteMenuItem(id: string): Promise<void> {
  requireEditAuth();
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { menuItemId: id } }),
    prisma.menuItem.delete({ where: { id } }),
  ]);
  revalidatePath("/menu-items");
}
