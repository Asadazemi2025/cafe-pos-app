-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Sale_eventId_idx" ON "Sale"("eventId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_eventId_idx" ON "Expense"("eventId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: レジ初め・締めを「日付」から「イベント」単位に変更
DROP INDEX IF EXISTS "DailyRegister_day_key";
ALTER TABLE "DailyRegister" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailyRegister_eventId_key" ON "DailyRegister"("eventId");

-- AddForeignKey
ALTER TABLE "DailyRegister" ADD CONSTRAINT "DailyRegister_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
