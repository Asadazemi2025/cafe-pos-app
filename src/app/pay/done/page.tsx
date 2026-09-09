// お客さまのスマホが、Stripeの決済ページのあとに戻ってくる画面。
// 合言葉なしで開けるよう、middlewareで認証の対象外にしている。
export default function PayDonePage({
  searchParams,
}: {
  searchParams: { canceled?: string };
}) {
  const canceled = searchParams.canceled === "1";

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-[420px] rounded-4xl border border-border bg-surface px-7 py-9 text-center shadow-card">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold ${
            canceled ? "bg-surface-hover text-ink-muted" : "bg-accent-weak-2 text-accent"
          }`}
        >
          {canceled ? "×" : "✓"}
        </div>

        <h1 className="mt-4 text-[22px] font-bold">
          {canceled ? "お支払いは行われていません" : "お支払いありがとうございました"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          {canceled
            ? "もう一度お支払いになる場合は、店舗のスタッフにお声がけください。"
            : "レシートが必要な場合は、店舗のスタッフにお声がけください。この画面は閉じていただいて大丈夫です。"}
        </p>

        <p className="mt-6 text-[11px] text-ink-placeholder">つむぐカフェ</p>
      </div>
    </div>
  );
}
