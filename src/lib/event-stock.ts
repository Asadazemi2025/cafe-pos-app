import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@prisma/client";

// 在庫はイベントごとに持つ。
// 材料やメニューそのもの(名前・単価・レシピ)はイベントをまたいで使い回すが、
// 「いま何グラム残っているか」「あと何個売れるか」はイベントごとに分ける。
// 前のイベントの残りが次のイベントに持ち越されて見えると、
// 用意していない在庫を売ってしまうため。

type Db = PrismaClient | Prisma.TransactionClient;

export type StockLine = { id: string; qty: number };

/** 材料ID → このイベントの残量 */
export async function getIngredientStockMap(
  eventId: string,
  db: Db = prisma,
): Promise<Map<string, number>> {
  const rows = await db.eventIngredientStock.findMany({
    where: { eventId },
    select: { ingredientId: true, stock: true },
  });
  return new Map(rows.map((r) => [r.ingredientId, r.stock.toNumber()]));
}

/** メニューID → このイベントの仕込み済み残数 */
export async function getMenuStockMap(
  eventId: string,
  db: Db = prisma,
): Promise<Map<string, number>> {
  const rows = await db.eventMenuStock.findMany({
    where: { eventId },
    select: { menuItemId: true, preparedStock: true },
  });
  return new Map(rows.map((r) => [r.menuItemId, r.preparedStock]));
}

// 在庫行はイベントごとに後から作られる。減算・加算の前に0の行を用意しておく。
async function ensureIngredientRows(db: Db, eventId: string, ingredientIds: string[]) {
  if (ingredientIds.length === 0) return;
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "EventIngredientStock" ("id", "eventId", "ingredientId", "stock", "updatedAt")
    SELECT gen_random_uuid()::text, ${eventId}, v.id, 0, now()
    FROM (VALUES ${Prisma.join(ingredientIds.map((id) => Prisma.sql`(${id}::text)`))}) AS v(id)
    ON CONFLICT ("eventId", "ingredientId") DO NOTHING
  `);
}

async function ensureMenuRow(db: Db, eventId: string, menuItemId: string) {
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "EventMenuStock" ("id", "eventId", "menuItemId", "preparedStock", "updatedAt")
    VALUES (gen_random_uuid()::text, ${eventId}, ${menuItemId}, 0, now())
    ON CONFLICT ("eventId", "menuItemId") DO NOTHING
  `);
}

/**
 * 材料を一括で減らす。1つでも足りなければ何も減らさずfalseを返す
 * (足りない材料の名前は呼び出し側で判断する)。
 */
export async function decrementIngredients(
  db: Db,
  eventId: string,
  lines: StockLine[],
): Promise<boolean> {
  if (lines.length === 0) return true;
  await ensureIngredientRows(db, eventId, lines.map((l) => l.id));

  const updated = await db.$queryRaw<{ ingredientId: string }[]>(Prisma.sql`
    UPDATE "EventIngredientStock" AS s
    SET "stock" = s."stock" - v.qty, "updatedAt" = now()
    FROM (VALUES ${Prisma.join(
      lines.map((l) => Prisma.sql`(${l.id}::text, ${l.qty}::numeric)`),
    )}) AS v(id, qty)
    WHERE s."eventId" = ${eventId} AND s."ingredientId" = v.id AND s."stock" >= v.qty
    RETURNING s."ingredientId"
  `);
  return updated.length === lines.length;
}

/** 材料を一括で戻す(会計の取消・数え直し) */
export async function incrementIngredients(
  db: Db,
  eventId: string,
  lines: StockLine[],
): Promise<void> {
  if (lines.length === 0) return;
  await ensureIngredientRows(db, eventId, lines.map((l) => l.id));

  await db.$executeRaw(Prisma.sql`
    UPDATE "EventIngredientStock" AS s
    SET "stock" = s."stock" + v.qty, "updatedAt" = now()
    FROM (VALUES ${Prisma.join(
      lines.map((l) => Prisma.sql`(${l.id}::text, ${l.qty}::numeric)`),
    )}) AS v(id, qty)
    WHERE s."eventId" = ${eventId} AND s."ingredientId" = v.id
  `);
}

/** 材料の残量をその値に置き換える(棚卸し・入力ミスの訂正) */
export async function setIngredientStock(
  eventId: string,
  ingredientId: string,
  stock: number,
  db: Db = prisma,
): Promise<void> {
  await db.eventIngredientStock.upsert({
    where: { eventId_ingredientId: { eventId, ingredientId } },
    create: { eventId, ingredientId, stock: new Prisma.Decimal(stock) },
    update: { stock: new Prisma.Decimal(stock) },
  });
}

export async function addIngredientStock(
  eventId: string,
  ingredientId: string,
  delta: number,
  db: Db = prisma,
): Promise<void> {
  await db.eventIngredientStock.upsert({
    where: { eventId_ingredientId: { eventId, ingredientId } },
    create: { eventId, ingredientId, stock: new Prisma.Decimal(delta) },
    update: { stock: { increment: new Prisma.Decimal(delta) } },
  });
}

/** 仕込み済みの残数を減らす。足りなければfalse */
export async function decrementMenuStock(
  db: Db,
  eventId: string,
  menuItemId: string,
  quantity: number,
): Promise<boolean> {
  await ensureMenuRow(db, eventId, menuItemId);
  const updated = await db.$executeRaw(Prisma.sql`
    UPDATE "EventMenuStock"
    SET "preparedStock" = "preparedStock" - ${quantity}, "updatedAt" = now()
    WHERE "eventId" = ${eventId} AND "menuItemId" = ${menuItemId} AND "preparedStock" >= ${quantity}
  `);
  return updated === 1;
}

export async function addMenuStock(
  eventId: string,
  menuItemId: string,
  delta: number,
  db: Db = prisma,
): Promise<void> {
  await db.eventMenuStock.upsert({
    where: { eventId_menuItemId: { eventId, menuItemId } },
    create: { eventId, menuItemId, preparedStock: Math.max(0, delta) },
    update: { preparedStock: { increment: delta } },
  });
}

export async function setMenuStock(
  eventId: string,
  menuItemId: string,
  preparedStock: number,
  db: Db = prisma,
): Promise<void> {
  await db.eventMenuStock.upsert({
    where: { eventId_menuItemId: { eventId, menuItemId } },
    create: { eventId, menuItemId, preparedStock },
    update: { preparedStock },
  });
}
