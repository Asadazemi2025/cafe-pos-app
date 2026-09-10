-- AlterTable(「300円で100g買った」をそのまま保存する)
ALTER TABLE "Ingredient" ADD COLUMN "purchasePrice" DECIMAL(14,2);
ALTER TABLE "Ingredient" ADD COLUMN "purchaseQty" DECIMAL(14,3);

-- 既存の材料は「単価そのままで1単位買った」として埋めておく(金額は変わらない)
UPDATE "Ingredient"
SET "purchasePrice" = "costPerUnit", "purchaseQty" = 1
WHERE "purchasePrice" IS NULL;
