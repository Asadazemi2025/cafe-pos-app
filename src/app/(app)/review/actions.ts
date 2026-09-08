"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireEditAuth } from "@/lib/auth";
import { getCurrentDayIndex, getCurrentEvent, requireCurrentEvent } from "@/lib/event";
import { getDaySummary } from "@/lib/day-summary";
import { getStock } from "@/app/(app)/stock/actions";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/money";

export type InsightTone = "accent" | "plum" | "alert" | "neutral";

export type Insight = {
  icon: string;
  title: string;
  body: string;
  tone: InsightTone;
};

export type JournalEntryDTO = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type ReviewData = {
  dayLabel: string;
  insights: Insight[];
  numbers: { key: string; label: string; value: string; note: string }[];
  journal: JournalEntryDTO[];
};

export async function getReview(): Promise<ReviewData | null> {
  requireAuth();
  const event = await getCurrentEvent();
  if (!event) return null;

  const day = event.dayList[event.dayIndex];
  const [summary, stock, journal] = await Promise.all([
    getDaySummary(event.id, event.dayIndex),
    getStock(),
    prisma.journalEntry.findMany({
      where: { eventId: event.id, dayIndex: event.dayIndex },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const insights: Insight[] = [];

  // 1) 損益分岐点
  if (summary.over >= 0 && summary.sales > 0) {
    insights.push({
      icon: "◎",
      title: "損益分岐点を突破しています",
      body: `分岐点を ${yen(summary.over)} 上回りました。ここから先の売上は ${Math.round(
        summary.cmRate * 100,
      )}% が利益として残ります。`,
      tone: "accent",
    });
  } else {
    insights.push({
      icon: "△",
      title: `黒字まであと ${yen(-summary.over)}`,
      body: summary.topProduct
        ? `主力の「${summary.topProduct.name}」なら あと${summary.unitsToBep}個 で分岐点に届きます。`
        : `固定費 ${yen(summary.fixedCost)} をまかなうところからのスタートです。`,
      tone: "plum",
    });
  }

  // 2) 売上の柱
  if (summary.topProduct && summary.sales > 0) {
    const share = Math.round((summary.topProduct.sales / summary.sales) * 100);
    insights.push({
      icon: "★",
      title: `売上の柱は「${summary.topProduct.name}」`,
      body: `売上 ${yen(summary.topProduct.sales)}・粗利 ${yen(
        summary.topProduct.margin,
      )}。この日の売上の ${share}% を占めています。`,
      tone: "neutral",
    });
  }

  // 3) ピークの時間帯
  const peak = [...summary.byHour].sort((a, b) => b.sales - a.sales)[0];
  if (peak && peak.sales > 0) {
    insights.push({
      icon: "◷",
      title: `${peak.hour}時台がピーク`,
      body: `この時間だけで ${yen(peak.sales)} 売れています。人員と仕込みをこの時間に寄せると取りこぼしが減ります。`,
      tone: "neutral",
    });
  }

  // 4) 在庫アラート
  const low = stock.rows.filter((r) => r.state !== "ok");
  if (low.length > 0) {
    insights.push({
      icon: "!",
      title: `${low.length}品が在庫切れ間近`,
      body: low
        .slice(0, 4)
        .map((r) => `${r.name}(残り${r.stock ?? 0})`)
        .join("、"),
      tone: "alert",
    });
  }

  return {
    dayLabel: `${day.label} ／ ${day.dateLabel}`,
    insights: insights.slice(0, 4),
    numbers: [
      {
        key: "SALES",
        label: "売上",
        value: yen(summary.sales),
        note: `${summary.saleCount}件の会計`,
      },
      {
        key: "GROSS",
        label: "粗利",
        value: yen(summary.margin),
        note: `粗利率 ${summary.sales > 0 ? Math.round((summary.margin / summary.sales) * 100) : 0}%`,
      },
      {
        key: "CUSTOMERS",
        label: "客数",
        value: `${summary.saleCount} 組`,
        note: `客単価 ${yen(summary.saleCount > 0 ? summary.sales / summary.saleCount : 0)}`,
      },
      {
        key: "UNITS",
        label: "点数",
        value: `${summary.unitCount} 点`,
        note: `1組あたり ${
          summary.saleCount > 0 ? (summary.unitCount / summary.saleCount).toFixed(1) : "0.0"
        }点`,
      },
    ],
    journal: journal.map((j) => ({
      id: j.id,
      body: j.body,
      author: j.author,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function addJournalEntry(body: string): Promise<void> {
  requireEditAuth();
  const text = body.trim();
  if (!text) throw new Error("日誌の内容を入力してください。");

  await prisma.journalEntry.create({
    data: {
      eventId: requireCurrentEvent(),
      dayIndex: getCurrentDayIndex(),
      body: text,
    },
  });
  revalidatePath("/review");
}

export async function deleteJournalEntry(id: string): Promise<void> {
  requireEditAuth();
  await prisma.journalEntry.delete({ where: { id } });
  revalidatePath("/review");
}
