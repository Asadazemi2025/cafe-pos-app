"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createExpense,
  deleteExpense,
  type ExpenseDTO,
  type ExpenseScopeDTO,
  type ExpenseSummary,
} from "@/app/(app)/expenses/actions";
import { yen } from "@/lib/money";

const SCOPES: { value: ExpenseScopeDTO; label: string; hint: string }[] = [
  { value: "PER_DAY", label: "1日あたり", hint: "毎日かかる費用(会場費・人件費など)" },
  { value: "WHOLE_EVENT", label: "イベント全体", hint: "期間全体で1回の費用(出店料・什器など)" },
];

export function ExpenseManager({
  rows,
  summary,
  readOnly = false,
}: {
  rows: ExpenseDTO[];
  summary: ExpenseSummary;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState<ExpenseScopeDTO>("PER_DAY");
  const [pending, setPending] = useState(false);

  function guard(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return true;
    }
    return false;
  }

  async function handleCreate() {
    if (guard()) return;
    if (!name.trim()) {
      toast.error("費目を入力してください。");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("金額を入力してください。");
      return;
    }
    setPending(true);
    try {
      await createExpense({ name, amount: value, scope });
      toast.success("経費を登録しました。");
      setName("");
      setAmount("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(row: ExpenseDTO) {
    if (guard()) return;
    if (!confirm(`「${row.name}」を削除しますか？`)) return;
    try {
      await deleteExpense(row.id);
      toast.success("削除しました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div className="anim-fade-up p-4 md:p-[22px]">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-3.5">
        <MetricCard label="イベント全体の費用" value={yen(summary.wholeTotal)} note="出店料など" />
        <MetricCard
          label="1日あたりの費用"
          value={yen(summary.perDayTotal)}
          note="毎日かかるもの"
        />
        <MetricCard
          label="損益分岐点に使う固定費 / 日"
          value={yen(summary.fixedPerDay)}
          note={`イベント全体分を ${summary.days}日で按分`}
          accent
        />
        <MetricCard
          label="イベント合計"
          value={yen(summary.eventTotal)}
          note={`全${summary.days}日ぶんの見込み`}
        />
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        <div className="flex-[1.5]">
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <div className="grid min-w-[640px] grid-cols-[1.6fr_108px_1fr_1.3fr_68px] items-center gap-3 border-b border-border bg-surface-alt px-[18px] py-3 text-[11px] font-bold text-ink-muted">
              <div>費目</div>
              <div>区分</div>
              <div className="text-right">金額</div>
              <div className="text-right">1日あたり</div>
              <div />
            </div>

            {rows.map((row) => (
              <div
                key={row.id}
                className="grid min-w-[640px] grid-cols-[1.6fr_108px_1fr_1.3fr_68px] items-center gap-3 border-b border-border-row px-[18px] py-[13px] last:border-b-0"
              >
                <div>
                  <div className="text-sm font-bold">{row.name}</div>
                  <div className="num text-[11px] text-ink-muted">{row.spentOn}</div>
                </div>
                <div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      row.scope === "PER_DAY"
                        ? "bg-accent-weak-2 text-accent-deep"
                        : "bg-surface-hover text-ink-muted"
                    }`}
                  >
                    {row.scope === "PER_DAY" ? "1日あたり" : "イベント全体"}
                  </span>
                </div>
                <div className="num text-right text-sm font-bold">{yen(row.amount)}</div>
                <div className="num text-right text-xs text-ink-muted">
                  {yen(row.perDay)} / 日
                  {row.scope === "WHOLE_EVENT" && "(按分)"}
                </div>
                <div className="text-right">
                  <button
                    onClick={() => handleDelete(row)}
                    className="press press-chip rounded-[8px] px-2 py-1 text-xs text-ink-placeholder hover:text-danger"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}

            {rows.length === 0 && (
              <p className="py-10 text-center text-sm text-ink-muted">
                まだ経費がありません。右のフォームから登録してください。
              </p>
            )}
          </div>

          <p className="mt-2.5 text-xs text-ink-muted">
            「イベント全体」の費用は営業日数({summary.days}日)で割って、1日あたりの固定費として損益分岐点の計算に使います。
          </p>
        </div>

        <div className="flex-1 rounded-2xl border border-border bg-surface p-[18px]">
          <h2 className="text-[15px] font-bold">経費を登録</h2>
          <p className="mt-1 text-xs text-ink-muted">
            材料以外の支出(会場費・消耗品・出店料など)を記録します。
          </p>

          <div className="mt-4 space-y-3.5">
            <Field label="費目">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 会場費"
                className="w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
              />
            </Field>
            <Field label="金額">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min={0}
                placeholder="0"
                className="num w-full rounded-xl border border-border px-[15px] py-[13px] text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
              />
            </Field>
            <Field label="区分">
              <div className="flex gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setScope(s.value)}
                    className={`press press-chip flex-1 rounded-xl border py-[11px] text-[13px] font-bold ${
                      scope === s.value
                        ? "border-accent bg-accent-weak text-accent-deep"
                        : "border-border text-ink-muted hover:border-border-strong"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="mt-1.5 block text-[11px] text-ink-muted">
                {SCOPES.find((s) => s.value === scope)?.hint}
              </span>
            </Field>
          </div>

          <button
            onClick={handleCreate}
            disabled={pending}
            className="press press-cta mt-4 w-full rounded-lg bg-accent py-[15px] text-[15px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "登録中…" : "登録する"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-[18px] py-4 ${
        accent ? "border-[#cfe0d8] bg-accent-weak-2" : "border-border bg-surface"
      }`}
    >
      <div className={`text-[11px] font-bold ${accent ? "text-accent-deep" : "text-ink-muted"}`}>
        {label}
      </div>
      <div
        className={`num mt-1.5 text-[26px] font-bold tracking-[-.01em] ${
          accent ? "text-accent-deep" : ""
        }`}
      >
        {value}
      </div>
      <div className={`mt-0.5 text-[11px] ${accent ? "text-accent-deep/80" : "text-ink-muted"}`}>
        {note}
      </div>
    </div>
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
