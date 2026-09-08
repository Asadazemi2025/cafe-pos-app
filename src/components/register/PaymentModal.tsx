"use client";

import { useState } from "react";
import type { PaymentMethodDTO } from "@/app/(app)/register/actions";
import { yen } from "@/lib/money";

const METHODS: { value: PaymentMethodDTO; label: string }[] = [
  { value: "CASH", label: "現金" },
  { value: "CASHLESS", label: "キャッシュレス" },
  { value: "POINT", label: "学内ポイント" },
];

const roundUp = (n: number, unit: number) => Math.ceil(n / unit) * unit;

export function PaymentModal({
  total,
  onClose,
  onPay,
}: {
  total: number;
  onClose: () => void;
  onPay: (method: PaymentMethodDTO, received: number) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethodDTO>("CASH");
  const [received, setReceived] = useState(0);
  const [pending, setPending] = useState(false);

  // お預かりのプリセット: 合計そのまま / 500円単位 / 1000円単位 / 次の5000円
  const presets = [...new Set([total, roundUp(total, 500), roundUp(total, 1000), roundUp(total + 1, 5000)])].slice(0, 4);
  const change = received - total;
  const canPay = method !== "CASH" || received >= total;

  async function submit() {
    if (!canPay || pending) return;
    setPending(true);
    try {
      await onPay(method, method === "CASH" ? received : total);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,35,26,.42)] p-4"
      onClick={onClose}
    >
      <div
        className="anim-pop w-[520px] rounded-3xl bg-surface px-7 pb-6 pt-[26px] shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-ink-muted">合計</span>
          <span className="num text-[34px] font-bold tracking-[-.02em]">{yen(total)}</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {METHODS.map((m) => {
            const on = method === m.value;
            return (
              <button
                key={m.value}
                onClick={() => {
                  setMethod(m.value);
                  setReceived(0);
                }}
                className={`press press-chip rounded-xl border py-3 text-[13px] font-bold ${
                  on
                    ? "border-accent bg-accent-weak text-accent-deep"
                    : "border-border bg-surface text-ink-muted"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {method === "CASH" && (
          <>
            <div className="mt-5 text-xs font-bold text-ink-muted">お預かり</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {presets.map((v) => (
                <button
                  key={v}
                  onClick={() => setReceived(v)}
                  className={`num press press-chip rounded-xl border py-3 text-sm font-bold ${
                    received === v
                      ? "border-accent bg-accent-weak text-accent-deep"
                      : "border-border bg-surface"
                  }`}
                >
                  {yen(v)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[13px] font-bold text-ink-muted">おつり</span>
              <span className="num text-[22px] font-bold">
                {received > 0 ? yen(Math.max(0, change)) : "—"}
              </span>
            </div>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="press press-cta flex-1 rounded-lg border border-border py-4 text-sm font-bold text-ink-muted"
          >
            戻る
          </button>
          <button
            onClick={submit}
            disabled={!canPay || pending}
            className={`press press-cta flex-[2] rounded-lg py-4 text-base font-bold text-white ${
              canPay ? "bg-accent" : "bg-[#c7c0b2]"
            }`}
          >
            {pending
              ? "処理中…"
              : method === "CASH"
                ? "現金で会計する"
                : `${METHODS.find((m) => m.value === method)?.label}で会計する`}
          </button>
        </div>
      </div>
    </div>
  );
}
