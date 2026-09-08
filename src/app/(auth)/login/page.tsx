"use client";

// 入口画面。チーム共通の合言葉を1つ入れるだけ。個人のメール・パスワードは不要。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, enterViewMode } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [viewPending, setViewPending] = useState(false);

  async function handleViewMode() {
    setError(null);
    setViewPending(true);
    await enterViewMode();
    setViewPending(false);
    router.push("/select-event");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push("/select-event");
    router.refresh();
  }

  return (
    <div className="anim-fade-up flex min-h-screen items-center justify-center px-4">
      <div className="w-[420px]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-dark text-[19px] font-bold text-white">
            珈
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-[.01em]">つむぐカフェ</h1>
            <p className="text-[13px] text-ink-muted">レジ・在庫・損益をひとつに</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-4xl border border-border bg-surface px-8 pb-7 pt-[26px] shadow-[0_20px_50px_-24px_rgba(40,35,26,.35)]"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-ink-muted">合言葉</span>
            <input
              type="password"
              name="passphrase"
              required
              autoFocus
              placeholder="チーム共通の合言葉"
              className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
            />
          </label>

          {error && (
            <p className="mt-3.5 rounded-xl bg-danger-weak px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="press press-cta mt-5 w-full rounded-lg bg-dark py-[17px] text-base font-bold text-white disabled:opacity-50"
          >
            {pending ? "確認中…" : "はじめる"}
          </button>

          <div className="mt-4 flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="h-px flex-1 bg-border" />
            または
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleViewMode}
            disabled={viewPending}
            className="press press-cta mt-4 w-full rounded-lg border border-border bg-surface py-[15px] text-[13px] font-bold text-ink-muted hover:border-accent hover:text-accent-deep disabled:opacity-50"
          >
            {viewPending ? "入場中…" : "閲覧モードで見る(合言葉なし・操作不可)"}
          </button>
        </form>

        <p className="mt-3.5 text-center text-[11px] text-ink-muted">
          合言葉はイベントの運営メンバーで共有してください。
        </p>
      </div>
    </div>
  );
}
