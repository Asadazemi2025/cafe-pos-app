"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createEvent,
  selectEvent,
  deleteEvent,
  type EventDTO,
} from "@/app/select-event/actions";
import { logout } from "@/app/logout/actions";
import { todayJST } from "@/lib/date";

const STATUS_STYLE = {
  ongoing: { label: "開催中", cls: "bg-accent-weak-2 text-accent-deep" },
  upcoming: { label: "開催予定", cls: "bg-surface-hover text-ink-muted" },
  finished: { label: "終了", cls: "bg-bg text-ink-muted" },
} as const;

export function EventSelector({
  events,
  readOnly = false,
}: {
  events: EventDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"home" | "form">(events.length === 0 ? "form" : "home");
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayJST());
  const [days, setDays] = useState("1");
  const [pending, setPending] = useState(false);

  async function handleSelect(id: string) {
    setPending(true);
    try {
      await selectEvent(id);
      router.push("/register");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
      setPending(false);
    }
  }

  async function handleDelete(ev: EventDTO) {
    if (readOnly) {
      toast.error("閲覧モードのため、削除できません。");
      return;
    }
    if (!confirm(`「${ev.name}」を削除しますか？(売上の記録は残ります)`)) return;
    try {
      await deleteEvent(ev.id);
      toast.success("削除しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  async function handleCreate() {
    if (readOnly) {
      toast.error("閲覧モードのため、イベントを作成できません。");
      return;
    }
    if (!name.trim()) {
      toast.error("イベント名を入力してください。");
      return;
    }
    setPending(true);
    try {
      await createEvent({ name, start, days: Number(days) });
      router.push("/register");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "作成に失敗しました。");
      setPending(false);
    }
  }

  if (view === "form") {
    return (
      <div className="anim-fade-up flex min-h-screen items-center justify-center px-4">
        <div className="w-[560px] rounded-4xl border border-border bg-surface px-9 pb-[30px] pt-[34px] shadow-[0_20px_50px_-24px_rgba(40,35,26,.35)]">
          <div className="flex items-center">
            {events.length > 0 && (
              <button
                onClick={() => setView("home")}
                className="press press-chip text-[13px] font-bold text-ink-muted hover:text-accent-deep"
              >
                ‹ イベント一覧
              </button>
            )}
            <LogoutButton className="ml-auto" />
          </div>
          <h1 className="mt-3 text-[22px] font-bold">新しいイベント</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            イベント単位で売上・レジ金・損益を分けて記録します。
          </p>

          <div className="mt-6 space-y-4">
            <Field label="イベント名">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none focus:border-accent"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始日">
                <input
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none focus:border-accent"
                />
              </Field>
              <Field label="営業日数">
                <input
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  type="number"
                  min={1}
                  max={14}
                  className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none focus:border-accent"
                />
              </Field>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={pending}
            className="press press-cta mt-6 w-full rounded-lg bg-dark py-[17px] text-base font-bold text-white disabled:opacity-50"
          >
            このイベントで開店する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up flex min-h-screen items-center justify-center px-4">
      <div className="w-[620px]">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">イベントを選ぶ</h1>
          <LogoutButton className="ml-auto" />
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          営業するイベントを選んで開店します。売上・レジ金・損益はイベントごとに分かれます。
        </p>

        <div className="mt-5 max-h-[440px] space-y-2.5 overflow-y-auto pr-1">
          {events.map((ev) => {
            const status = STATUS_STYLE[ev.status];
            return (
              <div
                key={ev.id}
                className={`press press-row flex cursor-pointer items-center gap-3.5 rounded-xl border bg-surface px-5 py-[18px] ${
                  ev.status === "ongoing" ? "border-accent" : "border-border"
                }`}
                onClick={() => !pending && handleSelect(ev.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-bold">{ev.name}</div>
                  <div className="text-xs text-ink-muted">{ev.rangeLabel}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
                  {status.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(ev);
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-ink-muted hover:border-danger hover:text-danger"
                >
                  削除
                </button>
                <span className="text-lg text-border-strong">›</span>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-muted">まだイベントがありません。</p>
          )}
        </div>

        <button
          onClick={() => setView("form")}
          className="press press-cta mt-2.5 w-full rounded-xl border-[1.5px] border-dashed border-border-strong py-[17px] text-[15px] font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
        >
          ＋ 新しいイベントを作成
        </button>
      </div>
    </div>
  );
}

// 別の人に引き継ぐとき用。合言葉のセッションと選択中イベントをまとめて消す
function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logout} className={className}>
      <button
        type="submit"
        className="press press-chip rounded-[9px] border border-border bg-surface px-3 py-[7px] text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
      >
        ログアウト
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
