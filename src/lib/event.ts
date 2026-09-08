import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { addDaysISO, jstDayKey, weekdayLabel } from "@/lib/date";

// 選択中のイベントと営業日はCookieで保持する。
// スタッフごとに別のイベント・別の日を開いて作業できるよう、DBの共有設定ではなくセッション側に持つ。
export const CURRENT_EVENT_COOKIE = "current_event";
export const CURRENT_DAY_COOKIE = "current_day";

export function getCurrentEventId(): string | null {
  return cookies().get(CURRENT_EVENT_COOKIE)?.value ?? null;
}

// 売上・レジ締め・経費など、イベントに紐づくデータを扱う処理の先頭で呼ぶ
export function requireCurrentEvent(): string {
  const eventId = getCurrentEventId();
  if (!eventId) redirect("/select-event");
  return eventId;
}

export function getCurrentDayIndex(): number {
  const raw = cookies().get(CURRENT_DAY_COOKIE)?.value;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function setCurrentEventCookie(eventId: string, dayIndex = 0) {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };
  cookies().set(CURRENT_EVENT_COOKIE, eventId, opts);
  cookies().set(CURRENT_DAY_COOKIE, String(dayIndex), opts);
}

export function setCurrentDayCookie(dayIndex: number) {
  cookies().set(CURRENT_DAY_COOKIE, String(dayIndex), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearCurrentEventCookie() {
  cookies().delete(CURRENT_EVENT_COOKIE);
  cookies().delete(CURRENT_DAY_COOKIE);
}

export type EventDay = {
  index: number;
  /** YYYY-MM-DD */
  date: string;
  /** 「1日目」 */
  label: string;
  /** 「9/6(日)」 */
  dateLabel: string;
};

export type CurrentEvent = {
  id: string;
  name: string;
  /** 開始日 YYYY-MM-DD */
  start: string;
  days: number;
  /** 選択中の営業日(0始まり) */
  dayIndex: number;
  dayList: EventDay[];
  /** 「9/6(日) 〜 9/9(水) ／ 全4日」 */
  rangeLabel: string;
};

export function buildDayList(start: string, days: number): EventDay[] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => {
    const date = addDaysISO(start, i);
    return {
      index: i,
      date,
      label: `${i + 1}日目`,
      dateLabel: weekdayLabel(date),
    };
  });
}

// ヘッダー・営業日バーの表示用。選択中イベントが削除済みならnullを返す
export const getCurrentEvent = cache(async (): Promise<CurrentEvent | null> => {
  const eventId = getCurrentEventId();
  if (!eventId) return null;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;

  const start = event.date.toISOString().slice(0, 10);
  const dayList = buildDayList(start, event.days);
  const dayIndex = Math.min(getCurrentDayIndex(), dayList.length - 1);
  const last = dayList[dayList.length - 1];

  return {
    id: event.id,
    name: event.name,
    start,
    days: event.days,
    dayIndex,
    dayList,
    rangeLabel:
      dayList.length === 1
        ? `${dayList[0].dateLabel} ／ 全1日`
        : `${dayList[0].dateLabel} 〜 ${last.dateLabel} ／ 全${dayList.length}日`,
  };
});

// 開催中 / 開催予定 / 終了 の判定(README: 経過日数 = today - start)
export type EventStatus = "ongoing" | "upcoming" | "finished";

export function eventStatus(start: string, days: number): EventStatus {
  const elapsed = Math.floor(
    (Date.parse(`${jstDayKey(new Date())}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86400000,
  );
  if (elapsed < 0) return "upcoming";
  if (elapsed <= days - 1) return "ongoing";
  return "finished";
}

// 開店時に開く営業日: clamp(today - start, 0, days-1)
export function initialDayIndex(start: string, days: number): number {
  const elapsed = Math.floor(
    (Date.parse(`${jstDayKey(new Date())}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86400000,
  );
  return Math.min(Math.max(elapsed, 0), Math.max(0, days - 1));
}
