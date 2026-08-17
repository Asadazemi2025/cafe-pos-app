"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkout, voidSaleAction, type RegisterMenuItemDTO, type RecentSaleDTO } from "@/app/(app)/register/actions";
import { yen } from "@/lib/money";
import { Modal } from "@/components/ui/Modal";
import { CardPaymentDialog } from "@/components/register/CardPaymentDialog";
import { Minus, Plus } from "lucide-react";

export function RegisterManager({
  menuItems,
  recentSales,
  readOnly = false,
}: {
  menuItems: RegisterMenuItemDTO[];
  recentSales: RecentSaleDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payMode, setPayMode] = useState<"cash" | "card" | null>(null);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, quantity]) => ({
          menuItemId,
          quantity,
          item: menuItems.find((m) => m.id === menuItemId)!,
        })),
    [cart, menuItems],
  );
  const total = lines.reduce((sum, l) => sum + l.item.salePrice * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  function add(id: string) {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return;
    }
    setCart((cur) => ({ ...cur, [id]: (cur[id] ?? 0) + 1 }));
  }
  function decrement(id: string) {
    if (readOnly) return;
    setCart((cur) => {
      const next = Math.max(0, (cur[id] ?? 0) - 1);
      return { ...cur, [id]: next };
    });
  }

  async function handleVoid(saleId: string) {
    if (readOnly) {
      toast.error("閲覧モードのため、取消できません。");
      return;
    }
    if (!confirm("この会計を取消しますか？材料は自動で在庫に戻ります。")) return;
    const result = await voidSaleAction(saleId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("取消しました。");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => add(item.id)}
              className="rounded-lg border border-border bg-surface p-3 text-left shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <p className="text-sm font-bold">{item.name}</p>
              <p className="num mt-1 text-xs text-ink-muted">{yen(item.salePrice)}</p>
            </button>
          ))}
          {menuItems.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-ink-muted">
              レジに表示するメニューがまだありません。「メニュー・レシピ」から登録してください。
            </p>
          )}
        </div>

        <div className="mt-8">
          <p className="mb-2 text-sm font-bold">直近の取引</p>
          <div className="space-y-1.5">
            {recentSales.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-sm ${
                  s.voided ? "opacity-50" : ""
                }`}
              >
                <span>
                  {new Date(s.occurredAt).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span className="ml-2 text-xs text-ink-muted">
                    {s.itemCount}点 ・ {s.paymentMethod === "CASH" ? "現金" : "カード"}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="num font-medium">{yen(s.totalAmount)}</span>
                  {s.voided ? (
                    <span className="text-xs text-danger">取消済み</span>
                  ) : (
                    <button
                      onClick={() => handleVoid(s.id)}
                      className="text-xs text-ink-muted underline hover:text-danger"
                    >
                      取消
                    </button>
                  )}
                </span>
              </div>
            ))}
            {recentSales.length === 0 && (
              <p className="py-4 text-center text-xs text-ink-muted">まだ取引がありません。</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-bold">カート</p>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">商品をタップして追加してください</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.menuItemId} className="flex items-center justify-between text-sm">
                <span>{l.item.name}</span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => decrement(l.menuItemId)}
                    className="rounded border border-border p-0.5 hover:bg-surface-hover"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="num w-4 text-center">{l.quantity}</span>
                  <button
                    onClick={() => add(l.menuItemId)}
                    className="rounded border border-border p-0.5 hover:bg-surface-hover"
                  >
                    <Plus size={12} />
                  </button>
                  <span className="num w-16 text-right">{yen(l.item.salePrice * l.quantity)}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold">合計({itemCount}点)</span>
          <span className="num text-lg font-bold">{yen(total)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (readOnly) {
                toast.error("閲覧モードのため、会計できません。");
                return;
              }
              if (lines.length === 0) return;
              setPayMode("cash");
            }}
            disabled={lines.length === 0}
            className="rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-40"
          >
            現金で会計
          </button>
          <button
            onClick={() => {
              if (readOnly) {
                toast.error("閲覧モードのため、会計できません。");
                return;
              }
              if (lines.length === 0) return;
              setPayMode("card");
            }}
            disabled={lines.length === 0}
            className="rounded-full border border-accent py-2.5 text-sm font-medium text-accent hover:bg-accent-weak disabled:opacity-40"
          >
            カードで会計
          </button>
        </div>
      </div>

      {payMode === "cash" && (
        <PaymentDialog
          total={total}
          items={lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }))}
          onClose={() => setPayMode(null)}
          onSuccess={() => {
            setCart({});
            setPayMode(null);
            router.refresh();
          }}
        />
      )}
      {payMode === "card" && (
        <CardPaymentDialog
          total={total}
          items={lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }))}
          onClose={() => setPayMode(null)}
          onSuccess={() => {
            setCart({});
            setPayMode(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  total,
  items,
  onClose,
  onSuccess,
}: {
  total: number;
  items: { menuItemId: string; quantity: number }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ change: number } | null>(null);

  const receivedNum = Number(received || 0);
  const change = receivedNum - total;

  function pressDigit(d: string) {
    setReceived((cur) => (cur === "0" ? d : cur + d));
  }

  async function finalize() {
    setPending(true);
    try {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await checkout({ items, clientId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setDone({ change: receivedNum > 0 ? change : 0 });
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Modal open onOpenChange={(o) => !o && onSuccess()} title="お会計完了">
        <div className="space-y-3 text-center">
          <p className="text-lg font-bold text-success">✓ お会計を完了しました</p>
          {done.change > 0 && (
            <p className="num text-sm text-ink-muted">おつり {yen(done.change)}</p>
          )}
          <button
            onClick={onSuccess}
            className="mt-2 w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            レジへ戻る
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="お支払い">
      <div className="space-y-3">
        <p className="num text-sm text-ink-muted">お会計 {yen(total)}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded border border-border px-3 py-2">
            <p className="text-[11px] text-ink-muted">お預かり</p>
            <p className="num text-lg font-bold">{received ? yen(receivedNum) : "¥0"}</p>
          </div>
          <button
            onClick={() => setReceived(String(total))}
            className="rounded border border-border px-3 py-2 text-xs font-medium hover:bg-surface-hover"
          >
            ちょうど受け取り({yen(total)})
          </button>
        </div>
        <p className="text-[11px] text-ink-muted">
          現金以外の場合はそのまま「会計する」を押してください
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => (
            <button
              key={k}
              onClick={() =>
                k === "⌫" ? setReceived((cur) => cur.slice(0, -1)) : pressDigit(k)
              }
              className="rounded border border-border py-2 text-sm font-medium hover:bg-surface-hover"
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={() => setReceived("")}
          className="w-full rounded border border-border py-1.5 text-xs text-ink-muted hover:bg-surface-hover"
        >
          クリア
        </button>

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-ink-muted">
            {received && receivedNum < total ? "未清算" : "おつり"}
          </span>
          <span className="num font-bold">
            {received ? yen(Math.max(0, change)) : "—"}
          </span>
        </div>

        <button
          onClick={finalize}
          disabled={pending}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "処理中…" : "会計する"}
        </button>
      </div>
    </Modal>
  );
}
