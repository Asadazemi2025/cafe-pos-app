"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCurrentEvent } from "@/lib/event";
import { getIngredientStockMap } from "@/lib/event-stock";
import { Prisma } from "@prisma/client";

export type RecipeLineDTO = {
  ingredientId: string;
  name: string;
  unit: string;
  /** この商品1個に使う量 */
  quantity: number;
  /** 1単位あたりの値段 */
  costPerUnit: number;
  /** quantity × costPerUnit */
  amount: number;
};

export type RecipeProductDTO = {
  id: string;
  name: string;
  category: string | null;
  salePrice: number;
  cost: number;
  margin: number;
  marginRate: number;
  lines: RecipeLineDTO[];
};

export type IngredientOptionDTO = {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  stock: number;
};

export async function getRecipes(): Promise<{
  products: RecipeProductDTO[];
  ingredients: IngredientOptionDTO[];
}> {
  requireAuth();

  const stocks = await getIngredientStockMap(requireCurrentEvent());
  const [items, ingredients, recipes] = await Promise.all([
    prisma.menuItem.findMany({ where: { isTest: false }, orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { isTest: false }, orderBy: { name: "asc" } }),
    prisma.recipeIngredient.findMany({ include: { ingredient: true } }),
  ]);

  const products: RecipeProductDTO[] = items.map((item) => {
    const lines: RecipeLineDTO[] = recipes
      .filter((r) => r.menuItemId === item.id)
      .map((r) => {
        const quantity = r.quantityPerUnit.toNumber();
        const costPerUnit = r.ingredient.costPerUnit.toNumber();
        return {
          ingredientId: r.ingredientId,
          name: r.ingredient.name,
          unit: r.ingredient.unit,
          quantity,
          costPerUnit,
          amount: quantity * costPerUnit,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const cost = lines.reduce((sum, l) => sum + l.amount, 0);
    const salePrice = item.salePrice.toNumber();
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      salePrice,
      cost,
      margin: salePrice - cost,
      marginRate: salePrice > 0 ? (salePrice - cost) / salePrice : 0,
      lines,
    };
  });

  return {
    products,
    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      costPerUnit: i.costPerUnit.toNumber(),
      stock: stocks.get(i.id) ?? 0,
    })),
  };
}

export type RecipeInputLine = {
  name: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
};

// レシピを丸ごと保存する。材料は名前で照合し、無ければその場で作る。
// 値段(単価)を書き換えたときは、その材料の単価も更新する
// = 同じ材料を使っている他の商品の原価にも反映される。
export async function saveRecipe(menuItemId: string, lines: RecipeInputLine[]): Promise<void> {
  requireEditAuth();

  const cleaned = lines
    .map((l) => ({
      name: l.name.trim(),
      unit: l.unit.trim() || "g",
      quantity: Number(l.quantity) || 0,
      costPerUnit: Number(l.costPerUnit) || 0,
    }))
    .filter((l) => l.name && l.quantity > 0);

  // 同じ材料が2行に分かれていたらまとめる
  const merged = new Map<string, RecipeInputLine>();
  for (const line of cleaned) {
    const key = line.name;
    const prev = merged.get(key);
    if (prev) {
      prev.quantity += line.quantity;
      prev.costPerUnit = line.costPerUnit;
    } else {
      merged.set(key, { ...line });
    }
  }

  await prisma.$transaction(async (tx) => {
    const resolved: { ingredientId: string; quantity: number }[] = [];

    for (const line of merged.values()) {
      const existing = await tx.ingredient.findFirst({
        where: { name: line.name, isTest: false },
      });

      if (existing) {
        await tx.ingredient.update({
          where: { id: existing.id },
          data: {
            unit: line.unit,
            costPerUnit: new Prisma.Decimal(line.costPerUnit),
          },
        });
        resolved.push({ ingredientId: existing.id, quantity: line.quantity });
      } else {
        const created = await tx.ingredient.create({
          data: {
            name: line.name,
            unit: line.unit,
            costPerUnit: new Prisma.Decimal(line.costPerUnit),
          },
        });
        resolved.push({ ingredientId: created.id, quantity: line.quantity });
      }
    }

    await tx.recipeIngredient.deleteMany({ where: { menuItemId } });
    if (resolved.length > 0) {
      await tx.recipeIngredient.createMany({
        data: resolved.map((r) => ({
          menuItemId,
          ingredientId: r.ingredientId,
          quantityPerUnit: new Prisma.Decimal(r.quantity),
        })),
      });
    }
  });

  revalidatePath("/recipes");
  revalidatePath("/stock");
  revalidatePath("/register");
  revalidatePath("/kanri");
}

/** 売価だけをこの画面から直せるようにする(原価と見比べながら決められるように) */
export async function updateSalePrice(menuItemId: string, salePrice: number): Promise<void> {
  requireEditAuth();
  if (salePrice < 0) throw new Error("売価を入力してください。");
  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { salePrice: new Prisma.Decimal(Math.round(salePrice)) },
  });
  revalidatePath("/recipes");
  revalidatePath("/register");
}
