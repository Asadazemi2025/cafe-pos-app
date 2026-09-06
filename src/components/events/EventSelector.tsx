"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEvent, selectEvent, type EventDTO } from "@/app/select-event/actions";
import { yen } from "@/lib/money";
import { todayJST } from "@/lib/date";
import { CalendarPlus, ChevronRight } from "lucide-react";

export function EventSelector({
  events,
  readOnly = false,
  currentEventId,
}: {
  events: EventDTO[];
  readOnly?: boolean;
  currentEventId: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayJST());
  const [pending, setPending] = useState(false);

  async function handleSelect(id: string) {
    setPending(true);
    try {
      await selectEvent(id);
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切り替えに失敗しました。");
      setPending(false);
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
      await createEvent({ name, date });
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "作成に失敗しました。");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-xl font-bold tracking-tight">イベント日を選ぶ</h1>
      <p className="mt-1 text-sm text-ink-muted">
        売上・レジ締め・経費は、ここで選んだイベントごとに分けて記録されます。
      </p>

      {!readOnly && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4 shadow-card">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold">
            <CalendarPlus size={15} />
            新しいイベント日を作る
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-ink-muted">
              イベント名
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 北浜マルシェ"
                className="mt-1 block w-48 rounded border border-border px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-muted">
              日付
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                className="mt-1 block rounded border border-border px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={handleCreate}
              disabled={pending}
              className="rounded bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              作成して開始
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <p className="text-sm font-bold">これまでのイベント</p>
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => handleSelect(e.id)}
            disabled={pending}
            className={`flex w-full items-center justify-between rounded-lg border bg-surface px-4 py-3 text-left shadow-card transition-colors hover:border-accent disabled:opacity-50 ${
              e.id === currentEventId ? "border-accent" : "border-border"
            }`}
          >
            <span>
              <span className="text-sm font-bold">{e.name}</span>
              <span className="ml-2 text-xs text-ink-muted">{e.date}</span>
              {e.id === currentEventId && (
                <span className="ml-2 rounded bg-accent-weak px-1.5 py-0.5 text-[10px] font-bold text-accent">
                  選択中
                </span>
              )}
              <span className="mt-0.5 block text-xs text-ink-muted">
                {e.saleCount}件 ・ {yen(e.salesTotal)}
              </span>
            </span>
            <ChevronRight size={16} className="text-ink-muted" />
          </button>
        ))}
        {events.length === 0 && (
          <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-ink-muted">
            まだイベントがありません。上のフォームから作成してください。
          </p>
        )}
      </div>
    </div>
  );
}
