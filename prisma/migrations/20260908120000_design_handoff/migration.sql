-- CreateEnum
CREATE TYPE "ExpenseScope" AS ENUM ('PER_DAY', 'WHOLE_EVENT');

-- AlterEnum(支払方法にキャッシュレス・学内ポイントを追加)
ALTER TYPE "PaymentMethod" ADD VALUE 'CASHLESS';
ALTER TYPE "PaymentMethod" ADD VALUE 'POINT';

-- AlterTable(イベントに営業日数)
ALTER TABLE "Event" ADD COLUMN "days" INTEGER NOT NULL DEFAULT 1;

-- AlterTable(売上・レジをイベント内の営業日で分ける)
ALTER TABLE "Sale" ADD COLUMN "dayIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DailyRegister" ADD COLUMN "dayIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DailyRegister" ADD COLUMN "closeCounts" JSONB;

-- レジは「1イベント1回」から「1営業日1回」へ
DROP INDEX IF EXISTS "DailyRegister_eventId_key";
CREATE UNIQUE INDEX "DailyRegister_eventId_dayIndex_key" ON "DailyRegister"("eventId", "dayIndex");

-- AlterTable(経費の計上単位)
ALTER TABLE "Expense" ADD COLUMN "scope" "ExpenseScope" NOT NULL DEFAULT 'PER_DAY';

-- AlterTable(基準在庫数)
ALTER TABLE "MenuItem" ADD COLUMN "par" INTEGER NOT NULL DEFAULT 0;
