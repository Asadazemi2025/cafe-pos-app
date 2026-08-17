"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, VIEWER_TOKEN } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(formData: FormData): Promise<LoginState | void> {
  const passphrase = String(formData.get("passphrase") ?? "");

  if (!passphrase || passphrase !== process.env.TEAM_PASSPHRASE) {
    return { error: "合言葉が違います。もう一度確認してください。" };
  }

  cookies().set(SESSION_COOKIE, process.env.TEAM_SESSION_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}

export async function enterViewMode(): Promise<void> {
  cookies().set(SESSION_COOKIE, VIEWER_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}
