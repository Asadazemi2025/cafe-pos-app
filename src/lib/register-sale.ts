import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { expandRecipeUsage, computeMenuItemCost, type IngredientUsageLine } from "@/lib/cost";

export type CartLine = { menuItemId: string; quantity: number };

function mergeCartLines(items: CartLine[]): CartLine[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (it.quantity <= 0) continue;
    map.set(it.menuItemId, (map.get(it.menuItemId) ?? 0) + it.quantity);
  }
  return [...map.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

// 現金・カード共通の会計コア処理。
// 1) カートの各メニューのレシピを材料消費量へ展開して材料ごとに合算
// 2) 1回のUPDATE文で在庫チェック+一括減算(浅田ラボのレジと同じ「足りなければロールバック」方式)
// 3) Sale + SaleItem(材料消費のスナップショット付き)を作成
export async function performSale(input: {
  items: CartLine[];
  paymentMethod: PaymentMethod;
  stripePaymentIntentId?: string | null;
  clientId?: string | null;
}): Promise<{ saleId: string; duplicate: boolean }> {
  if (input.clientId) {
    const existing = await prisma.sale.findUnique({ where: { clientId: input.clientId } });
    if (existing) return { saleId: existing.id, duplicate: true };
  }

  const merged = mergeCartLines(input.items);
  if (merged.length === 0) throw new Error("カートが空です。");

  try {
    const saleId = await prisma.$transaction(
      async (tx) => {
        const menuItems = await tx.menuItem.findMany({
          where: { id: { in: merged.map((m) => m.menuItemId) } },
        });
        if (menuItems.length !== merged.length) {
          throw new Error("存在しないメニューが含まれています。");
        }

        const lineUsages: { menuItemId: string; quantity: number; usage: IngredientUsageLine[] }[] = [];
        const totalUsage = new Map<string, number>();
        for (const line of merged) {
          const usage = await expandRecipeUsage(line.menuItemId, line.quantity, tx);
          lineUsages.push({ menuItemId: line.menuItemId, quantity: line.quantity, usage });
          for (const u of usage) {
            totalUsage.set(u.ingredientId, (totalUsage.get(u.ingredientId) ?? 0) + u.qty);
          }
        }

        if (totalUsage.size > 0) {
          const rows = [...totalUsage.entries()].map(([ingredientId, qty]) => ({ ingredientId, qty }));
          const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            UPDATE "Ingredient" AS i
            SET stock = i.stock - v.qty
            FROM (VALUES ${Prisma.join(
              rows.map((r) => Prisma.sql`(${r.ingredientId}::text, ${r.qty}::numeric)`),
            )}) AS v(id, qty)
            WHERE i.id = v.id AND i.stock >= v.qty
            RETURNING i.id
          `);
          const updatedSet = new Set(updated.map((r) => r.id));
          const missing = rows.filter((r) => !updatedSet.has(r.ingredientId));
          if (missing.length > 0) {
            throw new Error("材料の在庫が足りません。");
          }
        }

        let totalAmount = new Prisma.Decimal(0);
        let totalCost = new Prisma.Decimal(0);
        let itemCount = 0;
        const itemsData: Prisma.SaleItemCreateManySaleInput[] = [];

        for (const line of lineUsages) {
          const menuItem = menuItems.find((m) => m.id === line.menuItemId)!;
          const unitCost = await computeMenuItemCost(line.menuItemId, tx);
          const amount = menuItem.salePrice.mul(line.quantity);
          totalAmount = totalAmount.add(amount);
          totalCost = totalCost.add(unitCost.mul(line.quantity));
          itemCount += line.quantity;
          itemsData.push({
            menuItemId: menuItem.id,
            name: menuItem.name,
            unitPrice: menuItem.salePrice,
            unitCost,
            quantity: line.quantity,
            amount,
            ingredientUsage: line.usage as unknown as Prisma.InputJsonValue,
          });
        }

        const sale = await tx.sale.create({
          data: {
            totalAmount,
            totalCost,
            itemCount,
            paymentMethod: input.paymentMethod,
            stripePaymentIntentId: input.stripePaymentIntentId ?? null,
            clientId: input.clientId ?? null,
            items: { create: itemsData },
          },
        });
        return sale.id;
      },
      { timeout: 15000 },
    );

    return { saleId, duplicate: false };
  } catch (e) {
    // clientIdのユニーク制約違反 = 競合したオフライン再送。既存の会計を返す
    if (
      input.clientId &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await prisma.sale.findUnique({ where: { clientId: input.clientId } });
      if (existing) return { saleId: existing.id, duplicate: true };
    }
    throw e;
  }
}

export async function voidSale(saleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });
    if (sale.voided) throw new Error("この会計はすでに取消済みです。");

    const restock = new Map<string, number>();
    for (const item of sale.items) {
      const usage = (item.ingredientUsage as unknown as IngredientUsageLine[]) ?? [];
      for (const u of usage) {
        restock.set(u.ingredientId, (restock.get(u.ingredientId) ?? 0) + u.qty);
      }
    }

    if (restock.size > 0) {
      const rows = [...restock.entries()].map(([ingredientId, qty]) => ({ ingredientId, qty }));
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Ingredient" AS i
        SET stock = i.stock + v.qty
        FROM (VALUES ${Prisma.join(
          rows.map((r) => Prisma.sql`(${r.ingredientId}::text, ${r.qty}::numeric)`),
        )}) AS v(id, qty)
        WHERE i.id = v.id
      `);
    }

    await tx.sale.update({ where: { id: saleId }, data: { voided: true } });
  });
}
