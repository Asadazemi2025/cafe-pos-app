"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addJournalEntry,
  deleteJournalEntry,
  type InsightTone,
  type ReviewData,
} from "@/app/(app)/review/actions";

const TONE: Record<InsightTone, { icon: string; card: string }> = {
  accent: { icon: "bg-accent-weak-2 text-accent", card: "border-border bg-surface" },
  plum: { icon: "bg-accent-weak-2 text-accent-deep", card: "border-border bg-surface" },
  alert: { icon: "bg-alert-weak text-alert-deep", card: "border-alert-border bg-surface" },
  neutral: { icon: "bg-surface-hover text-ink-2", card: "border-border bg-surface" },
};

export function ReviewBoard({ data, readOnly = false }: { data: ReviewData; readOnly?: boolean }) {
  const router = useRouter();
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSave() {
    if (readOnly) {
      toast.error("閲覧モードのため、保存できません。");
      return;
    }
    if (!memo.trim()) {
      toast.error("日誌の内容を入力してください。");
      return;
    }
    setPending(true);
    try {
      await addJournalEntry(memo);
      toast.success("営業日誌を保存しました。");
      setMemo("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (readOnly) {
      toast.error("閲覧モードのため、削除できません。");
      return;
    }
    if (!confirm("この日誌を削除しますか？")) return;
    try {
      await deleteJournalEntry(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div className="anim-fade-up flex flex-col items-stretch gap-3.5 p-4 md:p-[22px] lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold">アプリからの気づき</h2>
        <p className="mt-1 text-[11px] text-ink-muted">
          {data.dayLabel} の記録から自動でまとめています。
        </p>

        <div className="mt-3 space-y-2.5">
          {data.insights.map((insight, i) => {
            const tone = TONE[insight.tone];
            return (
              <div
                key={i}
                className={`flex items-start gap-3.5 rounded-2xl border px-[18px] py-4 ${tone.card}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold ${tone.icon}`}
                >
                  {insight.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold">{insight.title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-ink-3">{insight.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="mt-6 text-[15px] font-bold">この日の数字</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-3.5">
          {data.numbers.map((n) => (
            <div key={n.key} className="rounded-2xl border border-border bg-surface px-[18px] py-4">
              <div className="num text-[10px] tracking-[.12em] text-ink-muted">{n.key}</div>
              <div className="num mt-1 text-[24px] font-bold tracking-[-.01em]">{n.value}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{n.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full shrink-0 rounded-2xl border border-border bg-surface p-[18px] lg:w-[392px]">
        <h2 className="text-[15px] font-bold">営業日誌</h2>
        <p className="mt-1 text-[11px] text-ink-muted">
          次に出店する人が読みます。数字に出ないことを残しておきましょう。
        </p>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="この日うまくいったこと、次に変えること。"
          className="mt-3 h-[104px] w-full resize-none rounded-xl border border-border px-3.5 py-3 text-[13px] leading-relaxed outline-none placeholder:text-ink-placeholder focus:border-accent"
        />
        <div className="flex items-center justify-between">
          <span className="num text-[11px] text-ink-muted">{memo.length} 文字</span>
          <button
            onClick={handleSave}
            disabled={pending}
            className="press press-cta rounded-[11px] bg-accent px-[18px] py-[11px] text-[13px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存する"}
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {data.journal.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-surface-alt px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                <span className="num">
                  {new Date(entry.createdAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{entry.author}</span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="ml-auto text-ink-placeholder hover:text-danger"
                >
                  削除
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{entry.body}</p>
            </div>
          ))}
          {data.journal.length === 0 && (
            <p className="py-6 text-center text-xs text-ink-muted">まだ日誌はありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}
