"use client";

import { yen } from "@/lib/money";

export type ReceiptLine = { name: string; quantity: number; unitPrice: number };

export function Receipt({
  lines,
  total,
  paymentMethod,
  received,
  change,
  occurredAt,
}: {
  lines: ReceiptLine[];
  total: number;
  paymentMethod: "CASH" | "CARD";
  received?: number;
  change?: number;
  occurredAt: Date;
}) {
  return (
    <div className="receipt-print mx-auto max-w-[280px] font-mono text-[13px] leading-relaxed text-ink">
      <div className="text-center">
        <p className="text-base font-bold">つむぐカフェ</p>
        <p className="mt-1 text-[11px] text-ink-muted">
          {occurredAt.toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-ink" />

      {lines.map((l, i) => (
        <div key={i} className="flex justify-between">
          <span>
            {l.name} ×{l.quantity}
          </span>
          <span className="num">{yen(l.unitPrice * l.quantity)}</span>
        </div>
      ))}

      <div className="my-3 border-t border-dashed border-ink" />

      <div className="flex justify-between text-base font-bold">
        <span>合計</span>
        <span className="num">{yen(total)}</span>
      </div>

      {paymentMethod === "CASH" ? (
        <>
          <div className="mt-2 flex justify-between">
            <span>お預かり</span>
            <span className="num">{yen(received ?? total)}</span>
          </div>
          <div className="flex justify-between">
            <span>おつり</span>
            <span className="num">{yen(change ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="mt-2 flex justify-between">
          <span>お支払い方法</span>
          <span>カード</span>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-ink-muted">またのご来店をお待ちしております</p>
    </div>
  );
}
