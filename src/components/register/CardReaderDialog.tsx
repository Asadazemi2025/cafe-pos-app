"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripeTerminal, type Terminal } from "@stripe/terminal-js";
import { toast } from "sonner";
import { createCardPaymentIntent, finalizeCardSale } from "@/app/(app)/register/stripe-actions";
import type { CartLine } from "@/lib/register-sale";
import { yen } from "@/lib/money";

// 実機のカードリーダー(Stripe Terminal)で支払う画面。
// リーダーが手元にないあいだは、Stripeが用意している
// シミュレートされたリーダーで動作確認できる。
// 本番のリーダーを使うときは NEXT_PUBLIC_STRIPE_SIMULATED_READER を "false" にする。
const USE_SIMULATED_READER = process.env.NEXT_PUBLIC_STRIPE_SIMULATED_READER !== "false";

let terminalPromise: Promise<Terminal> | null = null;

async function getTerminal(): Promise<Terminal> {
  if (!terminalPromise) {
    terminalPromise = (async () => {
      const StripeTerminal = await loadStripeTerminal();
      if (!StripeTerminal) throw new Error("Stripe Terminal SDKの読み込みに失敗しました。");
      return StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const res = await fetch("/api/stripe/connection-token", { method: "POST" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "接続トークンの取得に失敗しました。");
          return data.secret as string;
        },
        onUnexpectedReaderDisconnect: () => {
          toast.error("カードリーダーとの接続が切れました。");
        },
      });
    })();
  }
  return terminalPromise;
}

type Status = "connecting" | "ready" | "processing" | "error";

export function CardReaderDialog({
  total,
  items,
  onCancel,
  onPaid,
}: {
  total: number;
  items: CartLine[];
  onCancel: () => void;
  onPaid: (saleNo: string) => void;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [message, setMessage] = useState("カードリーダーに接続しています…");
  const terminalRef = useRef<Terminal | null>(null);
  const itemsRef = useRef(items);
  const onPaidRef = useRef(onPaid);
  itemsRef.current = items;
  onPaidRef.current = onPaid;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const terminal = await getTerminal();
        terminalRef.current = terminal;

        if (terminal.getConnectionStatus() === "connected") {
          if (!cancelled) {
            setStatus("ready");
            setMessage("リーダーに接続済みです");
          }
          return;
        }

        const discovery = await terminal.discoverReaders({ simulated: USE_SIMULATED_READER });
        if ("error" in discovery) throw new Error(discovery.error.message);
        if (discovery.discoveredReaders.length === 0) {
          throw new Error(
            "カードリーダーが見つかりませんでした。電源とネットワークを確認してください。",
          );
        }

        const connectResult = await terminal.connectReader(discovery.discoveredReaders[0]);
        if ("error" in connectResult) throw new Error(connectResult.error.message);

        if (!cancelled) {
          setStatus("ready");
          setMessage(
            `リーダーに接続しました(${discovery.discoveredReaders[0].label ?? "reader"})`,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "リーダーへの接続に失敗しました。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function pay() {
    const terminal = terminalRef.current;
    if (!terminal) return;

    setStatus("processing");
    setMessage("決済の準備をしています…");
    try {
      const intentResult = await createCardPaymentIntent(itemsRef.current);
      if (!intentResult.ok) {
        setStatus("error");
        setMessage(intentResult.message);
        return;
      }

      setMessage("カードをリーダーにかざしてください…");
      const collectResult = await terminal.collectPaymentMethod(intentResult.clientSecret);
      if ("error" in collectResult) throw new Error(collectResult.error.message);

      setMessage("決済を処理しています…");
      const processResult = await terminal.processPayment(collectResult.paymentIntent);
      if ("error" in processResult) throw new Error(processResult.error.message);

      setMessage("売上に記録しています…");
      const done = await finalizeCardSale(intentResult.paymentIntentId, itemsRef.current);
      if (!done.ok) {
        setStatus("error");
        setMessage(done.message);
        return;
      }

      onPaidRef.current(done.saleNo);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "決済に失敗しました。");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,35,26,.42)] p-4">
      <div className="anim-pop w-full max-w-[440px] rounded-3xl bg-surface px-7 pb-6 pt-[26px] shadow-modal">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold text-ink-muted">カードリーダーでお支払い</span>
          <span className="num text-[34px] font-bold tracking-[-.02em]">{yen(total)}</span>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div
            className={`flex h-[92px] w-[92px] items-center justify-center rounded-3xl text-[30px] ${
              status === "error"
                ? "bg-danger-weak text-danger"
                : status === "ready"
                  ? "bg-accent-weak-2 text-accent"
                  : "bg-surface-hover text-ink-muted"
            }`}
          >
            {status === "error" ? "!" : "▭"}
          </div>

          <p
            className={`mt-4 text-center text-[13px] ${
              status === "error" ? "text-danger" : "text-ink-muted"
            }`}
          >
            {message}
          </p>

          {USE_SIMULATED_READER && (
            <p className="mt-1.5 text-center text-[11px] text-ink-placeholder">
              いまはStripeのテスト用リーダーに接続しています。
              実機を使うときは環境変数 NEXT_PUBLIC_STRIPE_SIMULATED_READER を false にしてください。
            </p>
          )}
        </div>

        <button
          onClick={pay}
          disabled={status !== "ready"}
          className="press press-cta mt-6 w-full rounded-lg bg-accent py-4 text-base font-bold text-white disabled:bg-[#c7c0b2]"
        >
          {status === "processing" ? "処理中…" : "カードを読み取る"}
        </button>

        <button
          onClick={onCancel}
          disabled={status === "processing"}
          className="press press-cta mt-2 w-full rounded-lg border border-border py-3.5 text-sm font-bold text-ink-muted disabled:opacity-40"
        >
          {status === "error" ? "閉じる" : "やめる"}
        </button>
      </div>
    </div>
  );
}
