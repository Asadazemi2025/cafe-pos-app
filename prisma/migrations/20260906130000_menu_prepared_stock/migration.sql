-- CreateEnum
CREATE TYPE "MenuStockMode" AS ENUM ('MADE_TO_ORDER', 'PREPARED');

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "stockMode" "MenuStockMode" NOT NULL DEFAULT 'MADE_TO_ORDER';
ALTER TABLE "MenuItem" ADD COLUMN "preparedStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "fromPreparedStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MenuPreparation" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuPreparation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MenuPreparation" ADD CONSTRAINT "MenuPreparation_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
