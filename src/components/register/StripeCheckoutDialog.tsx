"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  createCheckoutSession,
  finalizeCheckoutSale,
  getCheckoutStatus,
} from "@/app/(app)/register/stripe-actions";
import type { CartLine } from "@/lib/register-sale";
import { yen } from "@/lib/money";
import { AppleMark } from "@/components/ui/AppleMark";

// Stripeの決済ページをQRコードで出す画面。
// お客さまがiPhoneで読み取ればApple Pay、そのほかカードやPayPayでも支払える。
// 支払いが終わったかどうかは、レジ側から数秒おきに確認する。
const POLL_MS = 3000;
const TIMEOUT_MS = 10 * 60 * 1000;

type Status = "preparing" | "waiting" | "finalizing" | "error";

export function StripeCheckoutDialog({
  total,
  items,
  onCancel,
  onPaid,
}: {
  total: number;
  items: CartLine[];
  onCancel: () => void;
  onPaid: (method: "CARD" | "PAYPAY", saleNo: string) => void;
}) {
  const [status, setStatus] = useState<Status>("preparing");
  const [message, setMessage] = useState("決済ページを準備しています…");
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  // 支払い完了の確認が二重に走らないようにする
  const settled = useRef(false);
  // 再描画のたびに決済ページを作り直さないよう、カートと通知先は参照で持つ
  const itemsRef = useRef(items);
  const onPaidRef = useRef(onPaid);
  itemsRef.current = items;
  onPaidRef.current = onPaid;

  const fail = useCallback((text: string) => {
    setStatus("error");
    setMessage(text);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(sessionId: string) {
      if (cancelled || settled.current) return;

      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        fail("時間切れになりました。もう一度やり直してください。");
        return;
      }

      const state = await getCheckoutStatus(sessionId);
      if (cancelled) return;

      if (!state.ok) {
        fail(state.message);
        return;
      }
      if (state.expired) {
        fail("決済ページの期限が切れました。もう一度やり直してください。");
        return;
      }
      if (state.paid) {
        settled.current = true;
        setStatus("finalizing");
        setMessage("支払いを確認しました。売上に記録しています…");
        const done = await finalizeCheckoutSale(sessionId, itemsRef.current);
        if (cancelled) return;
        if (!done.ok) {
          fail(done.message);
          return;
        }
        onPaidRef.current(done.method, done.saleNo);
        return;
      }

      timer = setTimeout(() => void poll(sessionId), POLL_MS);
    }

    (async () => {
      const created = await createCheckoutSession(itemsRef.current);
      if (cancelled) return;
      if (!created.ok) {
        fail(created.message);
        return;
      }

      setUrl(created.url);
      try {
        setQr(
          await QRCode.toDataURL(created.url, {
            width: 480,
            margin: 1,
            color: { dark: "#20261f", light: "#ffffff" },
          }),
        );
      } catch {
        // QRが作れなくてもリンクは出せるので、そのまま続ける
      }
      setStatus("waiting");
      setMessage("お客さまのiPhoneでQRコードを読み取ってください");
      timer = setTimeout(() => void poll(created.sessionId), POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // 決済ページの作成はこの画面を開いたときの1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,35,26,.42)] p-4">
      <div className="anim-pop w-[520px] rounded-3xl bg-surface px-7 pb-6 pt-[26px] shadow-modal">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1 text-[13px] font-bold text-ink-muted">
            <AppleMark className="h-[15px] w-[15px]" />
            Payでお支払い
          </span>
          <span className="num text-[34px] font-bold tracking-[-.02em]">{yen(total)}</span>
        </div>

        <div className="mt-5 flex flex-col items-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="決済ページのQRコード"
              className="h-[240px] w-[240px] rounded-xl border border-border bg-white p-2"
            />
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-surface-alt">
              <div className="h-10 w-10 animate-pulse rounded-full bg-surface-hover" />
            </div>
          )}

          <p
            className={`mt-4 text-center text-[13px] ${
              status === "error" ? "text-danger" : "text-ink-muted"
            }`}
          >
            {message}
          </p>

          {status === "waiting" && (
            <p className="mt-1 text-center text-[11px] text-ink-placeholder">
              iPhoneのカメラで読み取ると、Apple Payで支払えます(カード・PayPayも選べます)。
              支払いが終わると自動でこの画面が進みます。
            </p>
          )}

          {url && status === "waiting" && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="press press-chip mt-3 rounded-[9px] border border-border px-3 py-[7px] text-xs font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
            >
              この端末で決済ページを開く
            </a>
          )}
        </div>

        <button
          onClick={onCancel}
          disabled={status === "finalizing"}
          className="press press-cta mt-5 w-full rounded-lg border border-border py-4 text-sm font-bold text-ink-muted disabled:opacity-40"
        >
          {status === "error" ? "閉じる" : "支払いをやめる"}
        </button>
      </div>
    </div>
  );
}
