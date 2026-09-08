-- CreateTable(振り返りの営業日誌)
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "dayIndex" INTEGER NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'スタッフ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_eventId_dayIndex_idx" ON "JournalEntry"("eventId", "dayIndex");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
