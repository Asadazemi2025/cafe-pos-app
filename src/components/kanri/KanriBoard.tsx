"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createActionPlan,
  deleteActionPlan,
  saveProfitPlan,
  setKpiActual,
  setPrepMinutes,
  type KanriData,
} from "@/app/(app)/kanri/actions";
import { KPI_SOURCE_LABEL, KPI_SOURCES, type KpiSourceDTO } from "@/lib/kpi";
import { yen } from "@/lib/money";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num1 = (v: number) => v.toFixed(1);

export function KanriBoard({ data, readOnly = false }: { data: KanriData; readOnly?: boolean }) {
  const router = useRouter();
  const m = data.data;
  const [pending, setPending] = useState(false);

  function guard(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return true;
    }
    return false;
  }

  async function run(fn: () => Promise<void>, done?: string) {
    if (guard()) return;
    setPending(true);
    try {
      await fn();
      if (done) toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  const achieved = m.todayMargin >= m.requiredMarginPerDay && m.requiredMarginPerDay > 0;
  const shortfall = m.requiredMarginPerDay - m.todayMargin;

  // 制約1単位あたり利益の並び(提供時間が入っているものを上に)
  const throughput = [...m.products].sort((a, b) => {
    if (a.marginPerMinute === null && b.marginPerMinute === null) return b.unitMargin - a.unitMargin;
    if (a.marginPerMinute === null) return 1;
    if (b.marginPerMinute === null) return -1;
    return b.marginPerMinute - a.marginPerMinute;
  });
  const maxPerMinute = Math.max(1, ...throughput.map((p) => p.marginPerMinute ?? 0));

  return (
    <div className="anim-fade-up space-y-5 p-[22px]">
      {/* ---- 1. 固定費の回収 ---- */}
      <section>
        <SectionTitle
          title="固定費の回収"
          note={`${data.dayLabel}。毎日この粗利を積み上げないと、固定費を回収できません。`}
        />

        <div className="mt-3 grid grid-cols-5 gap-3.5">
          <Metric label="1日あたり固定費" value={yen(m.fixedPerDay)} note="経費を営業日数で按分" />
          <Metric label="目標利益 / 日" value={yen(m.dailyProfitTarget)} note="固定費回収後に残す額" />
          <Metric
            label="毎日必要な粗利"
            value={yen(m.requiredMarginPerDay)}
            note="固定費 + 目標利益"
            accent
          />
          <Metric
            label="必要売上 / 日"
            value={yen(m.requiredSalesPerDay)}
            note={`限界利益率 ${pct(m.cmRate)} で逆算`}
          />
          <Metric
            label="必要客数 / 日"
            value={`${Math.ceil(m.requiredCustomers)} 組`}
            note={`客単価 ${yen(m.avgTicket)}`}
          />
        </div>

        <div
          className={`mt-3 rounded-2xl border px-[18px] py-4 ${
            achieved ? "border-[#cfe0d8] bg-accent-weak-2" : "border-alert-border bg-alert-weak"
          }`}
        >
          <div className={`text-[13px] ${achieved ? "text-accent-deep" : "text-alert-deep"}`}>
            {achieved ? (
              <>
                この日の粗利 {yen(m.todayMargin)} は、必要な粗利 {yen(m.requiredMarginPerDay)} を
                {yen(m.todayMargin - m.requiredMarginPerDay)} 上回っています。
              </>
            ) : (
              <>
                この日の粗利は {yen(m.todayMargin)}。必要な粗利まで <b>{yen(shortfall)}</b>、
                売上に直すと <b>{yen(m.cmRate > 0 ? shortfall / m.cmRate : 0)}</b>、
                客数にすると <b>{Math.ceil(m.avgTicket > 0 ? shortfall / m.cmRate / m.avgTicket : 0)}組</b> 足りません。
              </>
            )}
          </div>
        </div>

        <PlanForm plan={data.plan} pending={pending} onSave={(v) => run(() => saveProfitPlan(v), "計画を保存しました。")} />
      </section>

      {/* ---- 2. 必要な売上構成 ---- */}
      <section>
        <SectionTitle
          title="必要な売上構成"
          note={`いまの売れ方(構成比)のまま必要売上 ${yen(m.requiredSalesPerDay)} に届かせるには、1日あたり何個売ればよいか。`}
        />
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          <TableHead cols="1.6fr .8fr .8fr 1fr 1fr 1fr">
            <div>商品</div>
            <div className="text-right">構成比</div>
            <div className="text-right">売価</div>
            <div className="text-right">必要数 / 日</div>
            <div className="text-right">実績 / 日</div>
            <div className="text-right">過不足</div>
          </TableHead>
          {m.requiredMix.map((row) => (
            <TableRow key={row.id} cols="1.6fr .8fr .8fr 1fr 1fr 1fr">
              <div className="text-sm font-bold">{row.name}</div>
              <div className="num text-right text-xs text-ink-muted">{pct(row.share)}</div>
              <div className="num text-right text-xs text-ink-muted">{yen(row.price)}</div>
              <div className="num text-right text-sm font-bold">
                {Math.ceil(row.requiredQtyPerDay)} 個
              </div>
              <div className="num text-right text-xs text-ink-muted">
                {num1(row.actualQtyPerDay)} 個
              </div>
              <div
                className={`num text-right text-xs font-bold ${
                  row.gap >= 0 ? "text-accent-deep" : "text-alert-deep"
                }`}
              >
                {row.gap >= 0 ? "+" : ""}
                {num1(row.gap)}
              </div>
            </TableRow>
          ))}
          {m.requiredMix.length === 0 && <Empty>まだ商品がありません。</Empty>}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          実績は、売上のあった{m.businessDaysWithSales}日で平均しています。
          構成比を変えたい(利益の大きい商品を増やしたい)ときは、下の「提供時間あたりの利益」と「一緒に売れる組み合わせ」を手がかりにしてください。
        </p>
      </section>

      {/* ---- 3. 提供時間あたりの利益 ---- */}
      <section>
        <SectionTitle
          title="提供時間あたりの利益(制約1単位あたり利益)"
          note={`人手が足りない日は、粗利の大きい商品より「1分あたりの粗利」が大きい商品を売るほうが、1日の利益は大きくなります。1日に使える提供時間は ${m.serviceHours}時間 × ${m.staffCount}人 = ${m.capacityMinutes}分。`}
        />
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          <TableHead cols="1.6fr .8fr .8fr .9fr 1fr 1.4fr">
            <div>商品</div>
            <div className="text-right">粗利 / 個</div>
            <div className="text-right">粗利率</div>
            <div className="text-right">提供時間</div>
            <div className="text-right">粗利 / 分</div>
            <div className="text-right">この商品だけで1日回したら</div>
          </TableHead>
          {throughput.map((p) => (
            <TableRow key={p.id} cols="1.6fr .8fr .8fr .9fr 1fr 1.4fr">
              <div>
                <div className="text-sm font-bold">{p.name}</div>
                <div className="text-[11px] text-ink-muted">{p.category}</div>
              </div>
              <div className="num text-right text-sm font-bold">{yen(p.unitMargin)}</div>
              <div className="num text-right text-xs text-ink-muted">{pct(p.marginRate)}</div>
              <div className="flex items-center justify-end gap-1">
                <input
                  defaultValue={p.prepMinutes || ""}
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="—"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v === p.prepMinutes) return;
                    void run(() => setPrepMinutes(p.id, v));
                  }}
                  className="num w-[54px] rounded-[8px] border border-border px-1.5 py-1 text-right text-xs outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink-muted">分</span>
              </div>
              <div className="num text-right text-sm font-bold">
                {p.marginPerMinute === null ? (
                  <span className="text-[11px] font-normal text-ink-placeholder">未設定</span>
                ) : (
                  yen(p.marginPerMinute)
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                {p.marginPerMinute !== null && (
                  <div className="h-[7px] w-[70px] overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(p.marginPerMinute / maxPerMinute) * 100}%` }}
                    />
                  </div>
                )}
                <span className="num text-xs text-ink-muted">
                  {p.marginPerMinute === null
                    ? "—"
                    : yen(p.marginPerMinute * m.capacityMinutes)}
                </span>
              </div>
            </TableRow>
          ))}
          {throughput.length === 0 && <Empty>まだ商品がありません。</Empty>}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          提供時間を入れると「粗利 / 分」が出ます。行列ができる時間帯は、この値の大きい商品に人手を寄せるのが会計上の最適解です。
        </p>
      </section>

      {/* ---- 4. 併売 ---- */}
      <section>
        <SectionTitle
          title="一緒に売れる組み合わせ"
          note="利益率の高い商品だけを売ればよいわけではありません。ある区分が、ほかの区分をどれだけ連れてきているかを見ます。"
        />

        <div className="mt-3 grid grid-cols-2 gap-3.5">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <TableHead cols="1fr .8fr 1fr 1fr">
              <div>区分</div>
              <div className="text-right">会計数</div>
              <div className="text-right">この区分あり／なしの客単価</div>
              <div className="text-right">押し上げ</div>
            </TableHead>
            {m.categories.map((c) => (
              <div key={c.category} className="border-b border-border-row px-[18px] py-3 last:border-b-0">
                <div className="grid grid-cols-[1fr_.8fr_1fr_1fr] items-center gap-3">
                  <div className="text-sm font-bold">{c.category}</div>
                  <div className="num text-right text-xs text-ink-muted">{c.saleCount}件</div>
                  <div className="num text-right text-xs">
                    {yen(c.avgWith)} ／ {yen(c.avgWithout)}
                  </div>
                  <div
                    className={`num text-right text-sm font-bold ${
                      c.uplift >= 0 ? "text-accent-deep" : "text-alert-deep"
                    }`}
                  >
                    {c.uplift >= 0 ? "+" : ""}
                    {yen(c.uplift)}
                  </div>
                </div>
                {c.attach.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.attach.map((a) => (
                      <span
                        key={a.category}
                        className="rounded-full bg-surface-alt px-2.5 py-1 text-[11px] text-ink-muted"
                      >
                        {c.category}を買った人の <b className="num">{pct(a.rate)}</b> が {a.category}
                        {a.lift >= 1.1 && <b className="ml-1 text-accent-deep">(相性◎)</b>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {m.categories.length === 0 && <Empty>まだ会計がありません。</Empty>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <TableHead cols="2fr .8fr .8fr">
              <div>よく一緒に買われる商品</div>
              <div className="text-right">件数</div>
              <div className="text-right">全会計比</div>
            </TableHead>
            {m.pairs.map((p) => (
              <TableRow key={`${p.a}-${p.b}`} cols="2fr .8fr .8fr">
                <div className="text-sm">
                  <b>{p.a}</b> ＋ <b>{p.b}</b>
                </div>
                <div className="num text-right text-xs text-ink-muted">{p.count}件</div>
                <div className="num text-right text-xs font-bold">{pct(p.rate)}</div>
              </TableRow>
            ))}
            {m.pairs.length === 0 && <Empty>2品以上の会計がまだありません。</Empty>}
          </div>
        </div>
      </section>

      {/* ---- 5. アクションプラン → KPI → 利益目標 ---- */}
      <section>
        <SectionTitle
          title="アクションプラン → 管理項目(KPI) → 利益目標"
          note={`打ち手ごとに測る数字を決めて、その積み上げが目標利益に届くかを見ます。見込みの合計は ${yen(
            data.plannedImpact,
          )} / 日、目標利益は ${yen(m.dailyProfitTarget)} / 日。`}
        />

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
          <TableHead cols="1.8fr 1.4fr .9fr .9fr 1.2fr 1fr 56px">
            <div>アクションプラン</div>
            <div>管理項目(KPI)</div>
            <div className="text-right">目標</div>
            <div className="text-right">実績</div>
            <div>達成率</div>
            <div className="text-right">見込み利益 / 日</div>
            <div />
          </TableHead>

          {data.actions.map((a) => (
            <TableRow key={a.id} cols="1.8fr 1.4fr .9fr .9fr 1.2fr 1fr 56px">
              <div>
                <div className="text-sm font-bold">{a.title}</div>
                {a.memo && <div className="text-[11px] text-ink-muted">{a.memo}</div>}
              </div>
              <div>
                <div className="text-[13px]">{a.kpiName}</div>
                <div className="text-[11px] text-ink-muted">{KPI_SOURCE_LABEL[a.source]}</div>
              </div>
              <div className="num text-right text-sm font-bold">
                {a.targetValue.toLocaleString("ja-JP")}
                {a.kpiUnit}
              </div>
              <div className="text-right">
                {a.source === "MANUAL" ? (
                  <input
                    defaultValue={a.manualValue ?? ""}
                    type="number"
                    placeholder="—"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v) || v === a.manualValue) return;
                      void run(() => setKpiActual(a.id, v));
                    }}
                    className="num w-[70px] rounded-[8px] border border-border px-1.5 py-1 text-right text-xs outline-none focus:border-accent"
                  />
                ) : (
                  <span className="num text-sm font-bold">
                    {a.actualValue === null
                      ? "—"
                      : `${Math.round(a.actualValue).toLocaleString("ja-JP")}${a.kpiUnit}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-bg">
                  <div
                    className={`h-full rounded-full ${
                      (a.progress ?? 0) >= 1 ? "bg-accent" : "bg-accent-soft"
                    }`}
                    style={{ width: `${Math.min(100, (a.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="num text-[11px] text-ink-muted">
                  {a.progress === null ? "—" : pct(a.progress)}
                </span>
              </div>
              <div className="num text-right text-xs font-bold">{yen(a.profitImpact)}</div>
              <div className="text-right">
                <button
                  onClick={() => {
                    if (guard()) return;
                    if (!confirm(`「${a.title}」を削除しますか？`)) return;
                    void run(() => deleteActionPlan(a.id), "削除しました。");
                  }}
                  className="press press-chip rounded-[8px] px-1.5 py-1 text-xs text-ink-placeholder hover:text-danger"
                >
                  ✕
                </button>
              </div>
            </TableRow>
          ))}
          {data.actions.length === 0 && (
            <Empty>
              まだアクションプランがありません。「何をするか」「それを何で測るか」「いくら利益が増えそうか」をセットで登録します。
            </Empty>
          )}
        </div>

        <ActionForm
          pending={pending}
          onCreate={(v) => run(() => createActionPlan(v), "アクションプランを登録しました。")}
        />
      </section>
    </div>
  );
}

// ---------- 計画の入力 ----------

function PlanForm({
  plan,
  pending,
  onSave,
}: {
  plan: KanriData["plan"];
  pending: boolean;
  onSave: (v: {
    dailyProfitTarget: number;
    serviceHours: number;
    staffCount: number;
    memo?: string;
  }) => void;
}) {
  const [target, setTarget] = useState(String(plan.dailyProfitTarget));
  const [hours, setHours] = useState(String(plan.serviceHours));
  const [staff, setStaff] = useState(String(plan.staffCount));
  const [memo, setMemo] = useState(plan.memo);

  return (
    <div className="mt-3 flex items-end gap-3 rounded-2xl border border-border bg-surface px-[18px] py-4">
      <Field label="目標利益 / 日" className="w-[140px]">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          type="number"
          min={0}
          className="num w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="営業時間" className="w-[110px]">
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          type="number"
          min={0.5}
          step="0.5"
          className="num w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="人数" className="w-[90px]">
        <input
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          type="number"
          min={1}
          className="num w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="メモ" className="flex-1">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="この日の狙い"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none placeholder:text-ink-placeholder focus:border-accent"
        />
      </Field>
      <button
        onClick={() =>
          onSave({
            dailyProfitTarget: Number(target) || 0,
            serviceHours: Number(hours) || 6,
            staffCount: Number(staff) || 1,
            memo,
          })
        }
        disabled={pending}
        className="press press-cta rounded-[11px] bg-accent px-5 py-[11px] text-[13px] font-bold text-white disabled:opacity-50"
      >
        計画を保存
      </button>
    </div>
  );
}

// ---------- アクションプランの追加 ----------

function ActionForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (v: {
    title: string;
    kpiName: string;
    kpiUnit: string;
    targetValue: number;
    source: KpiSourceDTO;
    profitImpact: number;
    memo?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [kpiName, setKpiName] = useState("");
  const [kpiUnit, setKpiUnit] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [source, setSource] = useState<KpiSourceDTO>("MANUAL");
  const [profitImpact, setProfitImpact] = useState("");

  return (
    <div className="mt-3 flex items-end gap-3 rounded-2xl border border-border bg-surface px-[18px] py-4">
      <Field label="アクションプラン" className="flex-[1.6]">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: ドリンク注文時にフードを一声かける"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none placeholder:text-ink-placeholder focus:border-accent"
        />
      </Field>
      <Field label="管理項目(KPI)" className="flex-1">
        <input
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          placeholder="例: 併売率"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none placeholder:text-ink-placeholder focus:border-accent"
        />
      </Field>
      <Field label="実績の取り方" className="w-[150px]">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as KpiSourceDTO)}
          className="w-full rounded-xl border border-border px-2 py-2.5 text-sm outline-none focus:border-accent"
        >
          {KPI_SOURCES.map((s) => (
            <option key={s} value={s}>
              {KPI_SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="目標値" className="w-[90px]">
        <input
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          type="number"
          className="num w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <Field label="単位" className="w-[70px]">
        <input
          value={kpiUnit}
          onChange={(e) => setKpiUnit(e.target.value)}
          placeholder="%"
          className="w-full rounded-xl border border-border px-2 py-2.5 text-sm outline-none placeholder:text-ink-placeholder focus:border-accent"
        />
      </Field>
      <Field label="見込み利益 / 日" className="w-[120px]">
        <input
          value={profitImpact}
          onChange={(e) => setProfitImpact(e.target.value)}
          type="number"
          className="num w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </Field>
      <button
        onClick={() => {
          onCreate({
            title,
            kpiName,
            kpiUnit,
            targetValue: Number(targetValue) || 0,
            source,
            profitImpact: Number(profitImpact) || 0,
          });
          setTitle("");
          setKpiName("");
          setTargetValue("");
          setProfitImpact("");
        }}
        disabled={pending}
        className="press press-cta rounded-[11px] bg-dark px-5 py-[11px] text-[13px] font-bold text-white disabled:opacity-50"
      >
        追加
      </button>
    </div>
  );
}

// ---------- 部品 ----------

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h2 className="text-[17px] font-bold">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{note}</p>
    </div>
  );
}

function Metric({
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
        className={`num mt-1 text-[24px] font-bold tracking-[-.01em] ${
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

function TableHead({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-3 border-b border-border bg-surface-alt px-[18px] py-3 text-[11px] font-bold text-ink-muted"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

function TableRow({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-3 border-b border-border-row px-[18px] py-3 last:border-b-0"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-[18px] py-8 text-center text-sm text-ink-muted">{children}</p>;
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
