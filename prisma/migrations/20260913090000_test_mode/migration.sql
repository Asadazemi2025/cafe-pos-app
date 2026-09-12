-- AlterTable(テストモードのレジ・アンケートを本番と分ける)
ALTER TABLE "DailyRegister" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "DailyRegister_eventId_dayIndex_key";
CREATE UNIQUE INDEX "DailyRegister_eventId_dayIndex_isTest_key" ON "DailyRegister"("eventId", "dayIndex", "isTest");

ALTER TABLE "SurveyResponse" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- 設定は1行だけ使う。無ければ作る
INSERT INTO "AppSetting" ("id", "testMode", "updatedAt")
VALUES ('singleton', false, now())
ON CONFLICT ("id") DO NOTHING;
