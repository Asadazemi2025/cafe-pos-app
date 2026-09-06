import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "team_session";
const VIEWER_TOKEN = "viewer";
const CURRENT_EVENT_COOKIE = "current_event";

function isAuthedRequest(req: NextRequest): boolean {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return token === process.env.TEAM_SESSION_TOKEN || token === VIEWER_TOKEN;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = isAuthedRequest(req);

  if (pathname === "/login") {
    if (authed) {
      return NextResponse.redirect(new URL("/select-event", req.url));
    }
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ログイン済みでもイベント日を選ぶまでは、どのデータを触っているか曖昧になるため
  // イベント選択画面へ寄せる
  const hasEvent = Boolean(req.cookies.get(CURRENT_EVENT_COOKIE)?.value);
  if (!hasEvent && pathname !== "/select-event") {
    return NextResponse.redirect(new URL("/select-event", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
