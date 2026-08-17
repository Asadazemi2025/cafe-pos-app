"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripeTerminal, type Terminal } from "@stripe/terminal-js";
import { toast } from "sonner";
import { createCardPaymentIntent, finalizeCardSale } from "@/app/(app)/register/stripe-actions";
import type { CartLine } from "@/lib/register-sale";
import { Modal } from "@/components/ui/Modal";
import { yen } from "@/lib/money";

// 開発中は実機のカードリーダーがなくても動作確認できるよう、
// シミュレートされたリーダーに接続する(実機導入後はfalseに変更する)。
const USE_SIMULATED_READER = true;

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

export function CardPaymentDialog({
  total,
  items,
  onClose,
  onSuccess,
}: {
  total: number;
  items: CartLine[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [statusText, setStatusText] = useState("カードリーダーに接続しています…");
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const terminal = await getTerminal();
        terminalRef.current = terminal;

        if (terminal.getConnectionStatus() === "connected") {
          if (!cancelled) {
            setStatus("ready");
            setStatusText("リーダーに接続済みです");
          }
          return;
        }

        const discovery = await terminal.discoverReaders({ simulated: USE_SIMULATED_READER });
        if ("error" in discovery) throw new Error(discovery.error.message);
        if (discovery.discoveredReaders.length === 0) {
          throw new Error("カードリーダーが見つかりませんでした。");
        }

        const connectResult = await terminal.connectReader(discovery.discoveredReaders[0]);
        if ("error" in connectResult) throw new Error(connectResult.error.message);

        if (!cancelled) {
          setStatus("ready");
          setStatusText(`リーダーに接続しました(${discovery.discoveredReaders[0].label ?? "reader"})`);
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setStatusText(e instanceof Error ? e.message : "リーダーへの接続に失敗しました。");
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
    setStatusText("決済の準備をしています…");
    try {
      const intentResult = await createCardPaymentIntent(items);
      if (!intentResult.ok) {
        setStatus("error");
        setStatusText(intentResult.message);
        return;
      }

      setStatusText("カードをリーダーにかざしてください…");
      const collectResult = await terminal.collectPaymentMethod(intentResult.clientSecret);
      if ("error" in collectResult) throw new Error(collectResult.error.message);

      setStatusText("決済を処理しています…");
      const processResult = await terminal.processPayment(collectResult.paymentIntent);
      if ("error" in processResult) throw new Error(processResult.error.message);

      const finalizeResult = await finalizeCardSale(intentResult.paymentIntentId, items);
      if (!finalizeResult.ok) {
        setStatus("error");
        setStatusText(finalizeResult.message);
        return;
      }

      toast.success("カード決済が完了しました。");
      onSuccess();
    } catch (e) {
      setStatus("error");
      setStatusText(e instanceof Error ? e.message : "決済に失敗しました。");
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="カードでお支払い">
      <div className="space-y-4 text-center">
        <p className="num text-lg font-bold">{yen(total)}</p>
        <p
          className={`text-sm ${
            status === "error" ? "text-danger" : "text-ink-muted"
          }`}
        >
          {statusText}
        </p>

        {USE_SIMULATED_READER && (
          <p className="text-[11px] text-ink-muted">
            (現在はシミュレートされたリーダーで動作確認しています)
          </p>
        )}

        <button
          onClick={pay}
          disabled={status !== "ready"}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-40"
        >
          {status === "processing" ? "処理中…" : "カードで会計する"}
        </button>

        {status === "error" && (
          <button
            onClick={onClose}
            className="w-full rounded-full border border-border py-2 text-sm text-ink-muted hover:bg-surface-hover"
          >
            閉じる
          </button>
        )}
      </div>
    </Modal>
  );
}
