"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkout, type RegisterMenuItemDTO } from "@/app/(app)/register/actions";
import {
  openRegister,
  closeRegister,
  reopenRegister,
  type SessionDTO,
} from "@/app/(app)/register/session-actions";
import { DenominationTable } from "@/components/register/DenominationTable";
import { PaymentModal, type PayChoice } from "@/components/register/PaymentModal";
import { StripeCheckoutDialog } from "@/components/register/StripeCheckoutDialog";
import { CompletionModal, type CompletedSale } from "@/components/register/CompletionModal";
import type { CashCounts } from "@/lib/denominations";
import { yen } from "@/lib/money";

const ALL = "__all__";

export function RegisterManager({
  products,
  session,
  dayLabel,
  storeName,
  readOnly = false,
}: {
  products: RegisterMenuItemDTO[];
  session: SessionDTO;
  dayLabel: string;
  storeName: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string>(ALL);
  const [payOpen, setPayOpen] = useState(false);
  const [stripeOpen, setStripeOpen] = useState(false);
  const [done, setDone] = useState<CompletedSale | null>(null);
  const [openCounts, setOpenCounts] = useState<CashCounts>({});
  const [closeCounts, setCloseCounts] = useState<CashCounts>({});
  const [closeOpen, setCloseOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))],
    [products],
  );
  const visible = useMemo(
    () => (category === ALL ? products : products.filter((p) => p.category === category)),
    [products, category],
  );

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => ({
          id,
          quantity,
          product: products.find((p) => p.id === id)!,
        }))
        .filter((l) => l.product),
    [cart, products],
  );
  const total = lines.reduce((s, l) => s + l.product.salePrice * l.quantity, 0);
  const margin = lines.reduce((s, l) => s + (l.product.salePrice - l.product.costPrice) * l.quantity, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  function guard(): boolean {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return true;
    }
    return false;
  }

  function add(id: string) {
    if (guard()) return;
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const next = (cart[id] ?? 0) + 1;
    if (p.stockMode === "PREPARED" && next > p.preparedStock) {
      toast.error(`「${p.name}」は残り${p.preparedStock}個です。`);
      return;
    }
    setCart((c) => ({ ...c, [id]: next }));
  }

  function bump(id: string, delta: number) {
    if (guard()) return;
    const p = products.find((x) => x.id === id);
    const next = Math.max(0, (cart[id] ?? 0) + delta);
    if (p && p.stockMode === "PREPARED" && next > p.preparedStock) {
      toast.error(`「${p.name}」は残り${p.preparedStock}個です。`);
      return;
    }
    setCart((c) => ({ ...c, [id]: next }));
  }

  async function handleOpen() {
    if (guard()) return;
    setPending(true);
    try {
      await openRegister(dayLabel, openCounts);
      toast.success("レジをはじめました。");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleClose() {
    if (guard()) return;
    setPending(true);
    try {
      const { diff } = await closeRegister(closeCounts);
      toast.success(diff === 0 ? "レジを締めました(差異なし)。" : `レジを締めました(差異 ${yen(diff)})。`);
      setCloseOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function handleReopen() {
    if (guard()) return;
    if (!confirm("レジ締めを取り消して、もう一度営業しますか？")) return;
    try {
      await reopenRegister();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "やり直しに失敗しました。");
    }
  }

  function receiptLines() {
    return lines.map((l) => ({
      name: l.product.name,
      quantity: l.quantity,
      unitPrice: l.product.salePrice,
    }));
  }

  async function handlePay(choice: PayChoice, received: number) {
    // カード・PayPay(オンライン)はStripeの決済ページへ。売上の記録は支払い完了後
    if (choice === "STRIPE") {
      setPayOpen(false);
      setStripeOpen(true);
      return;
    }

    const method = choice === "PAYPAY_QR" ? "PAYPAY" : "CASH";
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await checkout({
      items: lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })),
      method,
      clientId,
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setDone({
      no: result.saleNo,
      at: new Date(),
      lines: receiptLines(),
      total,
      method,
      received: method === "CASH" ? received : total,
      change: method === "CASH" ? Math.max(0, received - total) : 0,
    });
    setPayOpen(false);
    setCart({});
    router.refresh();
  }

  // Stripeの決済ページで支払いが終わったとき(売上はサーバー側で記録済み)
  function handleStripePaid(method: "CARD" | "PAYPAY", saleNo: string) {
    setDone({
      no: saleNo,
      at: new Date(),
      lines: receiptLines(),
      total,
      method,
      received: total,
      change: 0,
    });
    setStripeOpen(false);
    setCart({});
    router.refresh();
  }

  // --- 未開店 ---
  if (!session.opened) {
    return (
      <div className="anim-fade-up flex h-full items-center justify-center p-6">
        <div className="w-[440px] rounded-3xl border border-border bg-surface p-7 shadow-card">
          <h2 className="text-[19px] font-bold">{session.dayIndex + 1}日目 のレジをはじめる</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            釣銭準備金を金種ごとに数えて入力してください。レジ締めのときに、この金額と現金売上をもとに差異を出します。
          </p>
          <div className="mt-5">
            <DenominationTable counts={openCounts} onChange={setOpenCounts} />
          </div>
          <button
            onClick={handleOpen}
            disabled={pending}
            className="press press-cta mt-5 w-full rounded-lg bg-dark py-[17px] text-base font-bold text-white disabled:opacity-40"
          >
            レジをはじめる
          </button>
        </div>
      </div>
    );
  }

  // --- 締め済み ---
  if (session.closed) {
    const diff = session.diff ?? 0;
    return (
      <div className="anim-fade-up flex h-full items-center justify-center p-6">
        <div className="w-[520px] rounded-3xl border border-border bg-surface p-7 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[19px] font-bold">{session.dayIndex + 1}日目 は締め済み</h2>
            <span className="text-xs text-ink-muted">
              {session.closedAt
                ? `${new Date(session.closedAt).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} 締め`
                : ""}
            </span>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <Row label="釣銭準備金" value={yen(session.openCash)} />
            <Row label="現金売上" value={yen(session.cashSales)} />
            <Row label="キャッシュレス等" value={yen(session.cashlessSales)} />
            <Row label="理論在高" value={yen(session.theoretical)} />
            <Row label="実際の現金" value={yen(session.counted ?? 0)} />
          </dl>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-bold">差異</span>
            <span
              className={`num text-[22px] font-bold ${diff === 0 ? "text-accent-deep" : "text-danger"}`}
            >
              {diff === 0 ? "±¥0" : yen(diff)}
            </span>
          </div>

          <div className="mt-5 rounded-xl bg-surface-hover px-4 py-3">
            <div className="text-[11px] text-ink-muted">この日の売上</div>
            <div className="num text-[30px] font-bold">
              {yen(session.cashSales + session.cashlessSales)}
            </div>
          </div>

          <button
            onClick={handleReopen}
            className="press press-cta mt-4 w-full rounded-lg border border-border py-3 text-[13px] font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
          >
            締めをやり直す
          </button>
        </div>
      </div>
    );
  }

  // --- 稼働中 ---
  return (
    <div className="anim-fade-up flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col px-5 pt-[18px]">
        <div className="flex gap-2 pb-4">
          <Chip label="すべて" active={category === ALL} onClick={() => setCategory(ALL)} />
          {categories.map((c) => (
            <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
          ))}
          <button
            onClick={() => setCloseOpen(true)}
            className="press press-chip ml-auto rounded-full border border-border bg-surface px-4 py-[9px] text-[13px] font-bold text-ink-muted hover:border-accent hover:text-accent-deep"
          >
            レジ締め
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-5">
          <div className="grid grid-cols-3 gap-3">
            {visible.map((p) => {
              const soldOut = p.stockMode === "PREPARED" && p.preparedStock <= 0;
              const low =
                p.stockMode === "PREPARED" &&
                p.preparedStock <= Math.max(2, Math.round(p.par * 0.25));
              return (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  disabled={soldOut}
                  className={`press press-card flex min-h-[126px] flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-left hover:border-border-strong hover:shadow-card ${
                    soldOut ? "opacity-45" : ""
                  }`}
                >
                  <div className="flex justify-end">
                    {p.stockMode === "PREPARED" && (
                      <span
                        className={`num rounded-md bg-bg px-[7px] py-[3px] text-[10px] font-bold ${
                          soldOut ? "text-danger" : low ? "text-alert" : "text-ink-muted"
                        }`}
                      >
                        {soldOut ? "売切" : `残 ${p.preparedStock}`}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold leading-[1.35]">{p.name}</div>
                  <div className="num mt-auto text-base font-bold">{yen(p.salePrice)}</div>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="col-span-3 py-16 text-center text-sm text-ink-muted">
                商品がありません。「在庫」から登録してください。
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-[352px] shrink-0 flex-col border-l border-border bg-surface">
        <div className="flex items-baseline gap-2.5 px-5 pb-3 pt-[18px]">
          <div className="text-[15px] font-bold">お会計</div>
          <div className="num text-xs text-ink-muted">{count}点</div>
          <button
            onClick={() => setCart({})}
            className="press ml-auto text-xs text-ink-muted underline"
          >
            クリア
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-[13px] text-ink-placeholder">
              <div className="h-10 w-10 rounded-xl border-2 border-dashed border-border-strong" />
              商品をタップして追加
            </div>
          ) : (
            lines.map((l) => (
              <div
                key={l.id}
                className="anim-fade-up flex items-center gap-2.5 border-b border-border-row py-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{l.product.name}</div>
                  <div className="num text-[11px] text-ink-muted">
                    {yen(l.product.salePrice)} × {l.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 rounded-full bg-surface-hover p-[3px]">
                  <button
                    onClick={() => bump(l.id, -1)}
                    className="press press-step h-[26px] w-[26px] rounded-full bg-surface text-[15px] font-bold text-ink-muted"
                  >
                    −
                  </button>
                  <div className="num w-6 text-center text-[13px] font-bold">{l.quantity}</div>
                  <button
                    onClick={() => bump(l.id, 1)}
                    className="press press-step h-[26px] w-[26px] rounded-full bg-surface text-[15px] font-bold text-ink-muted"
                  >
                    ＋
                  </button>
                </div>
                <div className="num w-16 text-right text-sm font-bold">
                  {yen(l.product.salePrice * l.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>小計</span>
            <span className="num">{yen(total)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-accent-deep">
            <span>この会計の粗利</span>
            <span className="num">{yen(margin)}</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-sm font-bold">合計</span>
            <span className="num text-[28px] font-bold tracking-[-.02em]">{yen(total)}</span>
          </div>
          <button
            onClick={() => {
              if (guard()) return;
              if (lines.length === 0) return;
              setPayOpen(true);
            }}
            disabled={lines.length === 0}
            className="press press-cta mt-3 w-full rounded-lg bg-accent py-4 text-base font-bold text-white disabled:bg-[#c7c0b2]"
          >
            会計する
          </button>
        </div>
      </aside>

      {payOpen && (
        <PaymentModal total={total} onClose={() => setPayOpen(false)} onPay={handlePay} />
      )}
      {stripeOpen && (
        <StripeCheckoutDialog
          total={total}
          items={lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity }))}
          onCancel={() => setStripeOpen(false)}
          onPaid={handleStripePaid}
        />
      )}
      {done && (
        <CompletionModal sale={done} storeName={storeName} onClose={() => setDone(null)} />
      )}
      {closeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,35,26,.42)] p-4">
          <div className="anim-pop w-[440px] rounded-3xl bg-surface p-7 shadow-modal">
            <h2 className="text-[19px] font-bold">{session.dayIndex + 1}日目 のレジを締める</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              手元の現金を数えて入力してください。理論在高 {yen(session.theoretical)} と比べます。
            </p>
            <div className="mt-5">
              <DenominationTable counts={closeCounts} onChange={setCloseCounts} />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCloseOpen(false)}
                className="press press-cta flex-1 rounded-lg border border-border py-3.5 text-sm font-bold text-ink-muted"
              >
                やめる
              </button>
              <button
                onClick={handleClose}
                disabled={pending}
                className="press press-cta flex-[2] rounded-lg bg-dark py-3.5 text-sm font-bold text-white disabled:opacity-40"
              >
                レジを締める
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="num font-bold">{value}</dd>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`press press-chip rounded-full border px-[18px] py-[9px] text-[13px] font-bold ${
        active
          ? "border-dark bg-dark text-white"
          : "border-border bg-surface text-ink-muted hover:border-border-strong"
      }`}
    >
      {label}
    </button>
  );
}
