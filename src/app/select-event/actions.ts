"use server";

import { requireAuth, requireEditAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setCurrentEventCookie } from "@/lib/event";

export type EventDTO = {
  id: string;
  name: string;
  date: string;
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

  return events.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date.toISOString().slice(0, 10),
    saleCount: e.sales.length,
    salesTotal: e.sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
  }));
}

// 遷移はクライアント側のrouter.push()で行う(サーバー側のredirect()は
// クライアントのtry/catchに巻き込まれて動かないため)
export async function selectEvent(eventId: string): Promise<void> {
  requireAuth();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("そのイベントは見つかりませんでした。");
  setCurrentEventCookie(eventId);
}

export async function createEvent(input: { name: string; date: string }): Promise<void> {
  requireEditAuth();
  const name = input.name.trim();
  if (!name) throw new Error("イベント名を入力してください。");
  if (!input.date) throw new Error("日付を選んでください。");

  const created = await prisma.event.create({
    data: {
      name,
      // 日付だけのカラム(@db.Date)なのでUTCの0時として保存する。
      // JSTの0時で保存すると、読み出し時にUTC変換で前日にずれる。
      date: new Date(`${input.date}T00:00:00Z`),
    },
  });

  setCurrentEventCookie(created.id);
}
