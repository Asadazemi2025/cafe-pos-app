-- CreateEnum
CREATE TYPE "KpiSource" AS ENUM ('MANUAL', 'SALES', 'MARGIN', 'CUSTOMERS', 'UNIT_PRICE', 'UNITS', 'ATTACH_RATE', 'SURVEY_SCORE');

-- AlterTable(提供時間: 制約1単位あたり利益の計算に使う)
ALTER TABLE "MenuItem" ADD COLUMN "prepMinutes" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateTable(利益計画)
CREATE TABLE "ProfitPlan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dailyProfitTarget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "serviceHours" DECIMAL(5,2) NOT NULL DEFAULT 6,
    "staffCount" INTEGER NOT NULL DEFAULT 2,
    "memo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfitPlan_eventId_key" ON "ProfitPlan"("eventId");
ALTER TABLE "ProfitPlan" ADD CONSTRAINT "ProfitPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable(アクションプランとKPI)
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kpiName" TEXT NOT NULL,
    "kpiUnit" TEXT NOT NULL DEFAULT '',
    "targetValue" DECIMAL(14,2) NOT NULL,
    "source" "KpiSource" NOT NULL DEFAULT 'MANUAL',
    "manualValue" DECIMAL(14,2),
    "profitImpact" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ActionPlan_eventId_idx" ON "ActionPlan"("eventId");
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable(アンケート回答)
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "dayIndex" INTEGER NOT NULL DEFAULT 0,
    "satisfaction" INTEGER NOT NULL,
    "repeatIntent" INTEGER,
    "ageGroup" TEXT,
    "knownFrom" TEXT,
    "favoriteItem" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SurveyResponse_eventId_dayIndex_idx" ON "SurveyResponse"("eventId", "dayIndex");
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
