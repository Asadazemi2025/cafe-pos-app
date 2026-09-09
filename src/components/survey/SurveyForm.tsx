"use client";

import { useState } from "react";
import { submitSurvey } from "@/app/survey/[eventId]/actions";

const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代〜"];
const KNOWN_FROM = ["通りがかり", "SNS", "友人・知人", "チラシ・掲示", "前回も来た"];
const FACES = ["1", "2", "3", "4", "5"];
const FACE_LABEL = ["よくなかった", "あまり", "ふつう", "よかった", "とてもよかった"];

// お客さまがスマホで答えるアンケート。指で押せる大きさにしている。
export function SurveyForm({
  eventId,
  eventName,
  menuNames,
}: {
  eventId: string;
  eventName: string;
  menuNames: string[];
}) {
  const [satisfaction, setSatisfaction] = useState(0);
  const [repeatIntent, setRepeatIntent] = useState(0);
  const [ageGroup, setAgeGroup] = useState("");
  const [knownFrom, setKnownFrom] = useState("");
  const [favoriteItem, setFavoriteItem] = useState("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (satisfaction === 0) {
      setError("満足度を選んでください。");
      return;
    }
    setError(null);
    setPending(true);
    const result = await submitSurvey({
      eventId,
      satisfaction,
      repeatIntent: repeatIntent || null,
      ageGroup,
      knownFrom,
      favoriteItem,
      comment,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-[420px] rounded-4xl border border-border bg-surface px-7 py-9 text-center shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-weak-2 text-2xl font-bold text-accent">
            ✓
          </div>
          <h1 className="mt-4 text-[22px] font-bold">ありがとうございました</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            いただいたご意見は、次の出店づくりに使わせていただきます。
          </p>
          <p className="mt-6 text-[11px] text-ink-placeholder">{eventName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up mx-auto min-h-screen w-full max-w-[480px] px-5 py-8">
      <h1 className="text-[22px] font-bold">アンケートのお願い</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {eventName}。30秒ほどで終わります。答えたくない項目は飛ばして大丈夫です。
      </p>

      <div className="mt-6 space-y-5">
        <Block label="今日のお店はいかがでしたか" required>
          <div className="grid grid-cols-5 gap-1.5">
            {FACES.map((f, i) => (
              <button
                key={f}
                onClick={() => setSatisfaction(i + 1)}
                className={`press press-chip rounded-xl border py-3 text-[15px] font-bold ${
                  satisfaction === i + 1
                    ? "border-accent bg-accent-weak text-accent-deep"
                    : "border-border bg-surface text-ink-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-placeholder">
            <span>{FACE_LABEL[0]}</span>
            <span>{FACE_LABEL[4]}</span>
          </div>
        </Block>

        <Block label="また来たいと思いますか">
          <div className="grid grid-cols-5 gap-1.5">
            {FACES.map((f, i) => (
              <button
                key={f}
                onClick={() => setRepeatIntent(i + 1)}
                className={`press press-chip rounded-xl border py-3 text-[15px] font-bold ${
                  repeatIntent === i + 1
                    ? "border-accent bg-accent-weak text-accent-deep"
                    : "border-border bg-surface text-ink-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Block>

        <Block label="よかった商品">
          <select
            value={favoriteItem}
            onChange={(e) => setFavoriteItem(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-accent"
          >
            <option value="">選択しない</option>
            {menuNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Block>

        <Block label="年代">
          <ChipRow options={AGE_GROUPS} value={ageGroup} onChange={setAgeGroup} />
        </Block>

        <Block label="このお店を知ったきっかけ">
          <ChipRow options={KNOWN_FROM} value={knownFrom} onChange={setKnownFrom} />
        </Block>

        <Block label="ご意見・ご感想">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="よかったこと、こうしてほしいこと"
            className="h-[100px] w-full resize-none rounded-xl border border-border px-3.5 py-3 text-[15px] outline-none placeholder:text-ink-placeholder focus:border-accent"
          />
        </Block>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-weak px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="press press-cta mt-6 w-full rounded-lg bg-accent py-[17px] text-base font-bold text-white disabled:opacity-50"
      >
        {pending ? "送信中…" : "送信する"}
      </button>
    </div>
  );
}

function Block({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-bold">
        {label}
        {required && <span className="ml-1.5 text-[11px] font-normal text-alert">必須</span>}
      </div>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? "" : o)}
          className={`press press-chip rounded-full border px-3.5 py-2 text-[13px] font-bold ${
            value === o
              ? "border-accent bg-accent-weak text-accent-deep"
              : "border-border bg-surface text-ink-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
