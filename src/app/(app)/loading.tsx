// 画面を切り替えた瞬間に出す骨組み。
// これがあるとNext.jsがリンク先を先読みできるようになり、
// タップしてから何も起きない待ち時間がなくなる。
export default function Loading() {
  return (
    <div className="anim-fade-up p-[22px]">
      <div className="grid grid-cols-3 gap-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface px-[18px] py-4">
            <div className="h-3 w-24 animate-pulse rounded-full bg-surface-hover" />
            <div className="mt-2.5 h-7 w-32 animate-pulse rounded-lg bg-surface-hover" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded-full bg-surface-hover" />
          </div>
        ))}
      </div>

      <div className="mt-6 h-5 w-32 animate-pulse rounded-full bg-surface-hover" />

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="h-11 border-b border-border bg-surface-alt" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border-row px-[18px] py-[15px] last:border-b-0"
          >
            <div className="h-4 flex-[1.6] animate-pulse rounded-full bg-surface-hover" />
            <div className="h-4 flex-[.7] animate-pulse rounded-full bg-surface-hover" />
            <div className="h-4 flex-[1.5] animate-pulse rounded-full bg-surface-hover" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-surface-hover" />
          </div>
        ))}
      </div>
    </div>
  );
}
