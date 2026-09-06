import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// 選択中のイベント日はCookieで保持する。
// スタッフごとに別のイベントを開いて作業できるよう、DBの共有設定ではなくセッション側に持つ。
export const CURRENT_EVENT_COOKIE = "current_event";

export function getCurrentEventId(): string | null {
  return cookies().get(CURRENT_EVENT_COOKIE)?.value ?? null;
}

// 売上・レジ締め・経費など、イベントに紐づくデータを扱う処理の先頭で呼ぶ
export function requireCurrentEvent(): string {
  const eventId = getCurrentEventId();
  if (!eventId) redirect("/select-event");
  return eventId;
}

export function setCurrentEventCookie(eventId: string) {
  cookies().set(CURRENT_EVENT_COOKIE, eventId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearCurrentEventCookie() {
  cookies().delete(CURRENT_EVENT_COOKIE);
}

export type CurrentEvent = { id: string; name: string; date: string };

// サイドバー等の表示用。選択中イベントが削除済みならnullを返す
export async function getCurrentEvent(): Promise<CurrentEvent | null> {
  const eventId = getCurrentEventId();
  if (!eventId) return null;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  return { id: event.id, name: event.name, date: event.date.toISOString().slice(0, 10) };
}
