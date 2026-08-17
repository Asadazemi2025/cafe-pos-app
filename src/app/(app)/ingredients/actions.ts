"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type StockAdjustmentReason } from "@prisma/client";

export type IngredientDTO = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  costPerUnit: number;
  lowStockThreshold: number | null;
};

// PrismaのDecimalはクラスインスタンスなのでそのままではClient Componentへpropsとして渡せない。
// 読み取り系アクションは必ずプレーンな値に変換してから返す。
export async function getIngredients(): Promise<IngredientDTO[]> {
  requireAuth();
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    where: { isTest: false },
  });
  return ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    stock: i.stock.toNumber(),
    costPerUnit: i.costPerUnit.toNumber(),
    lowStockThreshold: i.lowStockThreshold?.toNumber() ?? null,
  }));
}

export async function getIngredientPurchases(ingredientId: string) {
  requireAuth();
  const purchases = await prisma.ingredientPurchase.findMany({
    where: { ingredientId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return purchases.map((p) => ({
    id: p.id,
    quantity: p.quantity.toNumber(),
    unitCost: p.unitCost.toNumber(),
    amount: p.amount.toNumber(),
    memo: p.memo,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function createIngredient(input: {
  name: string;
  unit: string;
  initialQuantity?: number;
  initialUnitCost?: number;
  lowStockThreshold?: number;
}): Promise<void> {
  requireEditAuth();
  const name = input.name.trim();
  if (!name) throw new Error("材料名を入力してください。");
  if (!input.unit.trim()) throw new Error("単位を入力してください。");

  await prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.create({
      data: {
        name,
        unit: input.unit.trim(),
        lowStockThreshold:
          input.lowStockThreshold != null ? new Prisma.Decimal(input.lowStockThreshold) : null,
      },
    });

    if (input.initialQuantity && input.initialQuantity > 0) {
      await recordPurchase(tx, {
        ingredientId: ingredient.id,
        quantity: input.initialQuantity,
        unitCost: input.initialUnitCost ?? 0,
        memo: "初期在庫",
      });
    }
  });

  revalidatePath("/ingredients");
}

// 仕入れ記録の共通処理。材料の在庫を加算し、単価を最新の仕入単価で更新する。
async function recordPurchase(
  tx: Prisma.TransactionClient,
  input: { ingredientId: string; quantity: number; unitCost: number; memo?: string | null },
) {
  const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: input.ingredientId } });
  const quantity = new Prisma.Decimal(input.quantity);
  const unitCost = new Prisma.Decimal(input.unitCost);

  const updated = await tx.ingredient.update({
    where: { id: ingredient.id },
    data: {
      stock: ingredient.stock.add(quantity),
      costPerUnit: input.unitCost > 0 ? unitCost : ingredient.costPerUnit,
    },
  });

  await tx.ingredientPurchase.create({
    data: {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity,
      unitCost,
      amount: quantity.mul(unitCost),
      memo: input.memo ?? null,
    },
  });

  return updated;
}

export async function createIngredientPurchase(input: {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  memo?: string;
}): Promise<void> {
  requireEditAuth();
  if (input.quantity <= 0) throw new Error("数量は1以上を入力してください。");

  await prisma.$transaction((tx) => recordPurchase(tx, input));
  revalidatePath("/ingredients");
}

export async function adjustIngredientStock(input: {
  ingredientId: string;
  nextStock: number;
  reason: StockAdjustmentReason;
  note?: string;
}): Promise<void> {
  requireEditAuth();

  await prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findUniqueOrThrow({
      where: { id: input.ingredientId },
    });
    const nextStock = new Prisma.Decimal(input.nextStock);
    const delta = nextStock.sub(ingredient.stock);

    await tx.ingredient.update({
      where: { id: ingredient.id },
      data: { stock: nextStock },
    });

    if (!delta.isZero()) {
      await tx.ingredientStockAdjustment.create({
        data: {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          delta,
          reason: input.reason,
          note: input.note ?? null,
        },
      });
    }
  });

  revalidatePath("/ingredients");
}

export async function deleteIngredient(id: string) {
  requireEditAuth();
  try {
    await prisma.ingredient.delete({ where: { id } });
  } catch {
    throw new Error("このメニューのレシピで使われているため削除できません。先にレシピから外してください。");
  }
  revalidatePath("/ingredients");
}
