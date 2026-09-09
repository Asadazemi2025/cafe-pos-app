"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSurveyResponse, type SurveyData } from "@/app/(app)/surveys/actions";
import { yen } from "@/lib/money";

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function SurveyBoard({ data, readOnly = false }: { data: SurveyData; readOnly?: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const link = `${window.location.origin}/survey/${data.eventId}`;
    setUrl(link);
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#20261f", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [data.eventId]);

  async function handleDelete(id: string) {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return;
    }
    if (!confirm("この回答を削除しますか？")) return;
    try {
      await deleteSurveyResponse(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  const maxDist = Math.max(1, ...data.distribution.map((d) => d.count));

  return (
    <div className="anim-fade-up space-y-5 p-4 md:p-[22px]">
      <div className="flex flex-col items-stretch gap-3.5 lg:flex-row lg:items-start">
        {/* QRコード */}
        <div className="w-full shrink-0 rounded-2xl border border-border bg-surface p-[18px] text-center lg:w-[280px]">
          <h2 className="text-[15px] font-bold">回答用のQRコード</h2>
          <p className="mt-1 text-[11px] text-ink-muted">
            レジ横に貼るか、会計後にお見せしてください。
          </p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="アンケートのQRコード"
              className="mx-auto mt-3 h-[190px] w-[190px] rounded-xl border border-border bg-white p-2"
            />
          ) : (
            <div className="mx-auto mt-3 h-[190px] w-[190px] rounded-xl border border-dashed border-border bg-surface-alt" />
          )}
          <p className="mt-2 break-all text-[10px] text-ink-placeholder">{url}</p>
          <button
            onClick={() => window.print()}
            className="press press-cta mt-3 w-full rounded-lg border border-border py-2.5 text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
          >
            印刷する
          </button>
        </div>

        {/* 指標 */}
        <div className="flex-1 space-y-3.5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-3.5">
            <Metric label="回答数" value={`${data.total} 件`} note="このイベントの合計" />
            <Metric
              label="平均満足度"
              value={data.avgSatisfaction === null ? "—" : `${data.avgSatisfaction.toFixed(1)} / 5`}
              note="1〜5の平均"
              accent
            />
            <Metric
              label="また来たい"
              value={data.avgRepeatIntent === null ? "—" : `${data.avgRepeatIntent.toFixed(1)} / 5`}
              note="再来店の意向"
            />
            <Metric
              label="回答率"
              value={data.responseRate === null ? "—" : pct(data.responseRate)}
              note="回答数 ÷ 会計数"
            />
          </div>

          <div className="rounded-2xl border border-border bg-surface px-[18px] py-4">
            <h3 className="text-[13px] font-bold">満足度の分布</h3>
            <div className="mt-3 space-y-1.5">
              {[...data.distribution].reverse().map((d) => (
                <div key={d.score} className="flex items-center gap-2.5">
                  <span className="num w-4 text-xs font-bold">{d.score}</span>
                  <div className="h-[14px] flex-1 overflow-hidden rounded-sm bg-surface-hover">
                    <div
                      className="h-full rounded-sm bg-accent-soft"
                      style={{ width: `${(d.count / maxDist) * 100}%` }}
                    />
                  </div>
                  <span className="num w-16 text-right text-xs text-ink-muted">
                    {d.count}件 {pct(d.rate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 自動の気づき */}
      {data.insights.length > 0 && (
        <section>
          <h2 className="text-[15px] font-bold">アンケートからの気づき</h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {data.insights.map((text, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface px-[18px] py-3.5 text-[13px] leading-relaxed text-ink-3"
              >
                {text}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 日別: 満足度と売上 */}
      <section>
        <h2 className="text-[15px] font-bold">日別の満足度と売上</h2>
        <p className="mt-1 text-xs text-ink-muted">
          満足度が上がった日に売上・客単価も上がっているかを見ます。
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
          <div className="grid min-w-[700px] grid-cols-[1.4fr_.8fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-border bg-surface-alt px-[18px] py-3 text-[11px] font-bold text-ink-muted">
            <div>営業日</div>
            <div className="text-right">回答</div>
            <div className="text-right">平均満足度</div>
            <div className="text-right">売上</div>
            <div className="text-right">客数</div>
            <div className="text-right">客単価</div>
          </div>
          {data.byDay.map((d) => (
            <div
              key={d.dayIndex}
              className="grid min-w-[700px] grid-cols-[1.4fr_.8fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-border-row px-[18px] py-3 last:border-b-0"
            >
              <div className="text-sm font-bold">
                {d.label}
                <span className="num ml-1.5 text-[11px] font-normal text-ink-muted">
                  {d.dateLabel}
                </span>
              </div>
              <div className="num text-right text-xs text-ink-muted">{d.responses}件</div>
              <div className="num text-right text-sm font-bold">
                {d.avgSatisfaction === null ? "—" : d.avgSatisfaction.toFixed(1)}
              </div>
              <div className="num text-right text-sm">{yen(d.sales)}</div>
              <div className="num text-right text-xs text-ink-muted">{d.customers}組</div>
              <div className="num text-right text-xs text-ink-muted">{yen(d.avgTicket)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 内訳 */}
      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Breakdown title="年代" rows={data.ageGroups} />
        <Breakdown title="知ったきっかけ" rows={data.knownFrom} />
        <Breakdown title="よかった商品" rows={data.favorites} />
      </section>

      {/* 自由記述 */}
      <section>
        <h2 className="text-[15px] font-bold">ご意見・ご感想</h2>
        <div className="mt-3 space-y-2.5">
          {data.comments.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-surface px-[18px] py-3.5">
              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                <span className="rounded-full bg-accent-weak-2 px-2 py-0.5 font-bold text-accent-deep">
                  満足度 {c.satisfaction}
                </span>
                <span>{c.dayLabel}</span>
                {c.ageGroup && <span>{c.ageGroup}</span>}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="ml-auto text-ink-placeholder hover:text-danger"
                >
                  削除
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{c.comment}</p>
            </div>
          ))}
          {data.comments.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-muted">まだ自由記述の回答はありません。</p>
          )}
        </div>
      </section>
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

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number; rate: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl border border-border bg-surface px-[18px] py-4">
      <h3 className="text-[13px] font-bold">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 6).map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span>{r.label}</span>
              <span className="num text-ink-muted">
                {r.count}件 {pct(r.rate)}
              </span>
            </div>
            <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-4 text-center text-xs text-ink-muted">未回答</p>}
      </div>
    </div>
  );
}
