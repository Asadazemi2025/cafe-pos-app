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
    router.push("/");
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

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-2xl bg-surface p-5 text-center shadow-card">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white font-bold shadow-card">
            珈
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight">カフェPOSへようこそ</h1>
          <p className="mt-1 text-sm text-ink-muted">合言葉を入れてください</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg bg-surface p-6 shadow-card-hover">
          <label className="block text-sm font-medium">
            合言葉
            <input
              type="password"
              name="passphrase"
              required
              autoFocus
              className="mt-1.5 w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
              placeholder="チーム共通の合言葉"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card transition-all duration-200 hover:opacity-90 hover:shadow-card-hover disabled:opacity-50"
          >
            {pending ? "確認中…" : "ログイン"}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-border" />
          または
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleViewMode}
          disabled={viewPending}
          className="mt-3 w-full rounded-full border border-border bg-surface py-2.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-hover disabled:opacity-50"
        >
          {viewPending ? "入場中…" : "閲覧モードで見る(合言葉不要・操作不可)"}
        </button>
      </div>
    </div>
  );
}
