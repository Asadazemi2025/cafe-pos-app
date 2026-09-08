"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { clearCurrentEventCookie } from "@/lib/event";

// ログアウト。合言葉のセッションだけでなく、選択中のイベント・営業日も消す。
// (次に入る人が、前の人のイベントを開いたまま操作しないようにするため)
export async function logout() {
  cookies().delete(SESSION_COOKIE);
  clearCurrentEventCookie();
  redirect("/login");
}
