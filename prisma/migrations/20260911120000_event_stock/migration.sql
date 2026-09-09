-- CreateTable(イベントごとの材料在庫)
CREATE TABLE "EventIngredientStock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventIngredientStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventIngredientStock_eventId_ingredientId_key" ON "EventIngredientStock"("eventId", "ingredientId");
CREATE INDEX "EventIngredientStock_eventId_idx" ON "EventIngredientStock"("eventId");
ALTER TABLE "EventIngredientStock" ADD CONSTRAINT "EventIngredientStock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventIngredientStock" ADD CONSTRAINT "EventIngredientStock_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable(イベントごとの仕込み済み残数)
CREATE TABLE "EventMenuStock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "preparedStock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMenuStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventMenuStock_eventId_menuItemId_key" ON "EventMenuStock"("eventId", "menuItemId");
CREATE INDEX "EventMenuStock_eventId_idx" ON "EventMenuStock"("eventId");
ALTER TABLE "EventMenuStock" ADD CONSTRAINT "EventMenuStock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMenuStock" ADD CONSTRAINT "EventMenuStock_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 既存の在庫は、いちばん新しいイベントの在庫として引き継ぐ
INSERT INTO "EventIngredientStock" ("id", "eventId", "ingredientId", "stock", "updatedAt")
SELECT gen_random_uuid()::text, e."id", i."id", i."stock", now()
FROM "Ingredient" i
CROSS JOIN (SELECT "id" FROM "Event" ORDER BY "date" DESC, "createdAt" DESC LIMIT 1) e
ON CONFLICT DO NOTHING;

INSERT INTO "EventMenuStock" ("id", "eventId", "menuItemId", "preparedStock", "updatedAt")
SELECT gen_random_uuid()::text, e."id", m."id", m."preparedStock", now()
FROM "MenuItem" m
CROSS JOIN (SELECT "id" FROM "Event" ORDER BY "date" DESC, "createdAt" DESC LIMIT 1) e
ON CONFLICT DO NOTHING;
