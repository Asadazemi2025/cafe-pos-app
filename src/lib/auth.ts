import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "team_session";
export const VIEWER_TOKEN = "viewer";

export type AuthRole = "full" | "viewer" | null;

export function getRole(): AuthRole {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (token === process.env.TEAM_SESSION_TOKEN) return "full";
  if (token === VIEWER_TOKEN) return "viewer";
  return null;
}

export function isAuthed(): boolean {
  return getRole() !== null;
}

// ページ表示・データ取得用。閲覧モードでも通す
export function requireAuth() {
  if (!isAuthed()) redirect("/login");
}

// 書き込みを行うすべてのサーバーアクションの先頭で呼ぶ。
// 閲覧モードでは例外を投げるので、呼び出し側は必ずtry/catchで受け止め、
// 「閲覧モードのため操作できません」等を表示すること(オフライン再送などの
// 汎用catchに巻き込まれると、失敗が成功したように見えるUIバグになる)。
export function requireEditAuth() {
  const role = getRole();
  if (role === null) redirect("/login");
  if (role === "viewer") {
    throw new Error("閲覧モードのため、この操作はできません。ログインしてお試しください。");
  }
}
