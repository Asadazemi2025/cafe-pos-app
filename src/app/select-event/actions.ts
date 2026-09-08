"use server";

import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildDayList,
  eventStatus,
  initialDayIndex,
  setCurrentDayCookie,
  setCurrentEventCookie,
  type EventStatus,
} from "@/lib/event";

export type EventDTO = {
  id: string;
  name: string;
  /** 開始日 YYYY-MM-DD */
  start: string;
  days: number;
  /** 「9/6(日) 〜 9/9(水) ／ 全4日」 */
  rangeLabel: string;
  status: EventStatus;
  saleCount: number;
  salesTotal: number;
};

export async function getEvents(): Promise<EventDTO[]> {
  requireAuth();
  const events = await prisma.event.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      sales: {
        where: { voided: false, isTest: false },
        select: { totalAmount: true },
      },
    },
  });

  return events.map((e) => {
    const start = e.date.toISOString().slice(0, 10);
    const dayList = buildDayList(start, e.days);
    const last = dayList[dayList.length - 1];
    return {
      id: e.id,
      name: e.name,
      start,
      days: e.days,
      rangeLabel:
        dayList.length === 1
          ? `${dayList[0].dateLabel} ／ 全1日`
          : `${dayList[0].dateLabel} 〜 ${last.dateLabel} ／ 全${dayList.length}日`,
      status: eventStatus(start, e.days),
      saleCount: e.sales.length,
      salesTotal: e.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
    };
  });
}

// 遷移はクライアント側のrouter.push()で行う(サーバー側のredirect()は
// クライアントのtry/catchに巻き込まれて動かないため)
export async function selectEvent(eventId: string): Promise<void> {
  requireAuth();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("そのイベントは見つかりませんでした。");
  const start = event.date.toISOString().slice(0, 10);
  setCurrentEventCookie(eventId, initialDayIndex(start, event.days));
}

export async function selectDay(dayIndex: number): Promise<void> {
  requireAuth();
  setCurrentDayCookie(Math.max(0, Math.floor(dayIndex)));
}

export async function createEvent(input: {
  name: string;
  start: string;
  days: number;
}): Promise<void> {
  requireEditAuth();
  const name = input.name.trim();
  if (!name) throw new Error("イベント名を入力してください。");
  if (!input.start) throw new Error("開始日を選んでください。");
  const days = Math.min(14, Math.max(1, Math.round(input.days || 1)));

  const created = await prisma.event.create({
    data: {
      name,
      // 日付だけのカラム(@db.Date)なのでUTCの0時として保存する。
      // JSTの0時で保存すると、読み出し時にUTC変換で前日にずれる。
      date: new Date(`${input.start}T00:00:00Z`),
      days,
    },
  });

  setCurrentEventCookie(created.id, initialDayIndex(input.start, days));
}

export async function deleteEvent(eventId: string): Promise<void> {
  requireEditAuth();
  // 売上・経費・レジ記録はイベント削除時にeventIdがnullになる(履歴は消さない)
  await prisma.event.delete({ where: { id: eventId } });
}
