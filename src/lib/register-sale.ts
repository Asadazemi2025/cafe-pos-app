import "server-only";
import { prisma } from "@/lib/prisma";
import { getTestMode } from "@/lib/app-mode";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { expandRecipeUsage, computeMenuItemCost, type IngredientUsageLine } from "@/lib/cost";
import {
  addMenuStock,
  decrementIngredients,
  decrementMenuStock,
  getMenuStockMap,
  incrementIngredients,
} from "@/lib/event-stock";

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
  eventId: string;
  dayIndex: number;
  stripePaymentIntentId?: string | null;
  clientId?: string | null;
}): Promise<{ saleId: string; saleNo: string; duplicate: boolean }> {
  if (input.clientId) {
    const existing = await prisma.sale.findUnique({ where: { clientId: input.clientId } });
    if (existing) {
      return { saleId: existing.id, saleNo: await saleNoFor(existing.id), duplicate: true };
    }
  }

  const merged = mergeCartLines(input.items);
  if (merged.length === 0) throw new Error("カートが空です。");

  const isTest = await getTestMode();

  try {
    const saleId = await prisma.$transaction(
      async (tx) => {
        const menuItems = await tx.menuItem.findMany({
          where: { id: { in: merged.map((m) => m.menuItemId) } },
        });
        if (menuItems.length !== merged.length) {
          throw new Error("存在しないメニューが含まれています。");
        }

        // 在庫はイベントごとに持つ。別のイベントの残りは使えない。
        const menuStock = await getMenuStockMap(input.eventId, tx);

        // 仕込み済みメニュー(PREPARED)は材料ではなく残り個数を減らす。
        // 材料は仕込み時にすでに消費しているため、ここでは触らない。
        const lineUsages: {
          menuItemId: string;
          quantity: number;
          usage: IngredientUsageLine[];
          fromPreparedStock: boolean;
        }[] = [];
        const totalUsage = new Map<string, number>();

        for (const line of merged) {
          const menuItem = menuItems.find((m) => m.id === line.menuItemId)!;
          if (menuItem.stockMode === "PREPARED") {
            const remaining = menuStock.get(menuItem.id) ?? 0;
            if (remaining < line.quantity) {
              throw new Error(`「${menuItem.name}」の残りが足りません(残り${remaining}個)。`);
            }
            const ok = await decrementMenuStock(tx, input.eventId, menuItem.id, line.quantity);
            if (!ok) {
              throw new Error(`「${menuItem.name}」の残りが足りません(残り${remaining}個)。`);
            }
            lineUsages.push({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
              usage: [],
              fromPreparedStock: true,
            });
            continue;
          }

          const usage = await expandRecipeUsage(line.menuItemId, line.quantity, tx);
          lineUsages.push({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            usage,
            fromPreparedStock: false,
          });
          for (const u of usage) {
            totalUsage.set(u.ingredientId, (totalUsage.get(u.ingredientId) ?? 0) + u.qty);
          }
        }

        if (totalUsage.size > 0) {
          const rows = [...totalUsage.entries()].map(([id, qty]) => ({ id, qty }));
          const ok = await decrementIngredients(tx, input.eventId, rows);
          if (!ok) {
            throw new Error("このイベントの材料在庫が足りません。");
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
            fromPreparedStock: line.fromPreparedStock,
          });
        }

        const sale = await tx.sale.create({
          data: {
            eventId: input.eventId,
            dayIndex: input.dayIndex,
            totalAmount,
            totalCost,
            itemCount,
            paymentMethod: input.paymentMethod,
            // テストモード中の会計は、本番の売上に混ざらないよう印を付ける
            isTest,
            stripePaymentIntentId: input.stripePaymentIntentId ?? null,
            clientId: input.clientId ?? null,
            items: { create: itemsData },
          },
        });
        return sale.id;
      },
      { timeout: 15000 },
    );

    return { saleId, saleNo: await saleNoFor(saleId), duplicate: false };
  } catch (e) {
    // clientIdのユニーク制約違反 = 競合したオフライン再送。既存の会計を返す
    if (
      input.clientId &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await prisma.sale.findUnique({ where: { clientId: input.clientId } });
      if (existing) {
        return { saleId: existing.id, saleNo: await saleNoFor(existing.id), duplicate: true };
      }
    }
    throw e;
  }
}

// 伝票番号。イベント内の通し番号を4桁でゼロ埋めする(例: 0012)
async function saleNoFor(saleId: string): Promise<string> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { eventId: true, occurredAt: true },
  });
  if (!sale?.eventId) return "0001";
  const seq = await prisma.sale.count({
    where: { eventId: sale.eventId, occurredAt: { lte: sale.occurredAt } },
  });
  return String(seq).padStart(4, "0");
}

export async function voidSale(saleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });
    if (sale.voided) throw new Error("この会計はすでに取消済みです。");
    // 在庫はイベントごとなので、その会計を記録したイベントへ戻す
    const eventId = sale.eventId;

    const restock = new Map<string, number>();
    for (const item of sale.items) {
      // 仕込み在庫から売れた行は、材料ではなくメニューの残り個数を戻す
      if (item.fromPreparedStock) {
        if (item.menuItemId && eventId) {
          await addMenuStock(eventId, item.menuItemId, item.quantity, tx);
        }
        continue;
      }
      const usage = (item.ingredientUsage as unknown as IngredientUsageLine[]) ?? [];
      for (const u of usage) {
        restock.set(u.ingredientId, (restock.get(u.ingredientId) ?? 0) + u.qty);
      }
    }

    if (restock.size > 0 && eventId) {
      await incrementIngredients(
        tx,
        eventId,
        [...restock.entries()].map(([id, qty]) => ({ id, qty })),
      );
    }

    await tx.sale.update({ where: { id: saleId }, data: { voided: true } });
  });
}
