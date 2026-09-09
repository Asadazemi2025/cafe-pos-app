"use client";

import type { PaymentMethodDTO } from "@/app/(app)/register/actions";
import { yen } from "@/lib/money";

export type CompletedSale = {
  no: string;
  at: Date;
  lines: { name: string; quantity: number; unitPrice: number }[];
  total: number;
  method: PaymentMethodDTO;
  received: number;
  change: number;
};

const METHOD_LABEL: Record<PaymentMethodDTO, string> = {
  CASH: "現金",
  CARD: "カード",
  PAYPAY: "PayPay",
  EMONEY: "電子マネー",
};

function stamp(at: Date) {
  return at.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 58mm幅のレシートを非表示iframeに書き出して印刷する(README準拠)。
// レシートプリンタのSDKを使う場合は、この関数だけ差し替えればよい。
function printReceipt(sale: CompletedSale, storeName: string) {
  const rows = sale.lines
    .map(
      (l) =>
        `<div class="line"><div>${l.name} ×${l.quantity}</div><div>${yen(
          l.unitPrice * l.quantity,
        )}</div></div>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 58mm auto; margin: 4mm; }
    body { width: 50mm; margin: 0; font-family: "Hiragino Kaku Gothic ProN", sans-serif; font-size: 10.5px; }
    .center { text-align: center; }
    .hr { border-top: 1px dashed #000; margin: 6px 0; }
    .line { display: flex; justify-content: space-between; gap: 6px; }
    .total { font-size: 13px; font-weight: 700; }
  </style></head><body>
    <div class="center"><b>${storeName}</b></div>
    <div class="center">${stamp(sale.at)}</div>
    <div class="center">No.${sale.no}</div>
    <div class="hr"></div>
    ${rows}
    <div class="hr"></div>
    <div class="line total"><div>合計</div><div>${yen(sale.total)}</div></div>
    <div class="line"><div>${METHOD_LABEL[sale.method]}</div><div>${yen(sale.received)}</div></div>
    ${sale.method === "CASH" ? `<div class="hr"></div><div class="line total"><div>おつり</div><div>${yen(sale.change)}</div></div>` : ""}
    <div class="hr"></div>
    <div class="center">ありがとうございました</div>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 1000);
}

export function CompletionModal({
  sale,
  storeName,
  onClose,
}: {
  sale: CompletedSale;
  storeName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,35,26,.42)] p-4">
      <div className="anim-pop w-full max-w-[480px] rounded-4xl bg-surface p-8 shadow-modal">
        <div className="flex flex-col items-center">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent-weak-2 text-[30px] text-accent">
            ✓
          </div>
          <div className="mt-3 text-[17px] font-bold">会計が完了しました</div>
          <div className="num mt-1 text-xs text-ink-muted">
            {stamp(sale.at)} ／ No.{sale.no}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border p-4">
          {sale.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <span className="text-[13px] font-bold">{l.name}</span>
              <span className="num text-xs text-ink-muted">×{l.quantity}</span>
              <span className="num w-20 text-right text-[13px] font-bold">
                {yen(l.unitPrice * l.quantity)}
              </span>
            </div>
          ))}
          <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
            <span className="text-[13px] font-bold">合計</span>
            <span className="num text-[26px] font-bold">{yen(sale.total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px]">
            <span className="text-ink-muted">{METHOD_LABEL[sale.method]}</span>
            <span className="num">{yen(sale.received)}</span>
          </div>
          {sale.method === "CASH" && (
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-border pt-2">
              <span className="text-[13px] font-bold">おつり</span>
              <span className="num text-[22px] font-bold text-accent-deep">{yen(sale.change)}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => printReceipt(sale, storeName)}
            className="press press-cta flex-1 rounded-lg border-[1.5px] border-dark bg-surface py-3.5 text-sm font-bold"
          >
            レシートを印刷
          </button>
          <button
            onClick={onClose}
            className="press press-cta flex-1 rounded-lg bg-dark py-3.5 text-sm font-bold text-white"
          >
            次の会計へ
          </button>
        </div>
      </div>
    </div>
  );
}
