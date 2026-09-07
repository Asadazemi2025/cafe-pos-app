"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkout, voidSaleAction, type RegisterMenuItemDTO, type RecentSaleDTO } from "@/app/(app)/register/actions";
import { yen } from "@/lib/money";
import { Modal } from "@/components/ui/Modal";
import { CardPaymentDialog } from "@/components/register/CardPaymentDialog";
import { Receipt, type ReceiptLine } from "@/components/register/Receipt";
import { Minus, Plus, X, CreditCard, Banknote } from "lucide-react";

// カテゴリごとにタイルの色を変える(エアレジのように、色で商品を探せるように)
const TILE_COLORS = [
  { bg: "#fdeadb", border: "#f3c79b" },
  { bg: "#dff0fb", border: "#a8d4ee" },
  { bg: "#e2f5e6", border: "#a9dcb5" },
  { bg: "#fce9f1", border: "#f0b9d1" },
  { bg: "#ece7fa", border: "#c3b6ec" },
  { bg: "#fff5d6", border: "#efd88f" },
];

const ALL = "__all__";

function colorForCategory(category: string | null, categories: string[]) {
  const idx = category ? categories.indexOf(category) : -1;
  return TILE_COLORS[(idx < 0 ? 0 : idx) % TILE_COLORS.length];
}

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
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [showRecent, setShowRecent] = useState(false);

  const categories = useMemo(
    () => [...new Set(menuItems.map((m) => m.category).filter((c): c is string => !!c))],
    [menuItems],
  );

  const visibleItems = useMemo(
    () =>
      activeCategory === ALL
        ? menuItems
        : menuItems.filter((m) => (m.category ?? "") === activeCategory),
    [menuItems, activeCategory],
  );

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

  function add(id: string, quantity = 1) {
    if (readOnly) {
      toast.error("閲覧モードのため、操作できません。");
      return;
    }
    const item = menuItems.find((m) => m.id === id);
    const next = (cart[id] ?? 0) + quantity;
    if (item && item.stockMode === "PREPARED" && next > item.preparedStock) {
      toast.error(`「${item.name}」の残りは${item.preparedStock}個です。`);
      return;
    }
    setCart((cur) => ({ ...cur, [id]: next }));
  }

  function decrement(id: string) {
    if (readOnly) return;
    setCart((cur) => ({ ...cur, [id]: Math.max(0, (cur[id] ?? 0) - 1) }));
  }

  function removeLine(id: string) {
    if (readOnly) return;
    setCart((cur) => ({ ...cur, [id]: 0 }));
  }

  // カートの個数を直接入力する(まとめて何個、を素早く入れられるように)
  function setQuantity(id: string, value: string) {
    if (readOnly) return;
    const item = menuItems.find((m) => m.id === id);
    let next = Math.max(0, Math.round(Number(value) || 0));
    if (item && item.stockMode === "PREPARED" && next > item.preparedStock) {
      toast.error(`「${item.name}」の残りは${item.preparedStock}個です。`);
      next = item.preparedStock;
    }
    setCart((cur) => ({ ...cur, [id]: next }));
  }

  function clearCart() {
    if (readOnly) return;
    if (lines.length === 0) return;
    if (!confirm("カートを空にしますか？")) return;
    setCart({});
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

  const receiptLines: ReceiptLine[] = lines.map((l) => ({
    name: l.item.name,
    quantity: l.quantity,
    unitPrice: l.item.salePrice,
  }));
  const cartItems = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* 商品側 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* カテゴリタブ */}
        <div className="flex flex-wrap items-center gap-1.5 pb-3">
          <CategoryTab
            label="すべて"
            active={activeCategory === ALL}
            onClick={() => setActiveCategory(ALL)}
          />
          {categories.map((c) => (
            <CategoryTab
              key={c}
              label={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
          <button
            onClick={() => setShowRecent(true)}
            className="ml-auto rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover"
          >
            直近の取引
          </button>
        </div>

        {/* 商品タイル */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-surface-hover/60 p-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => {
              const soldOut = item.stockMode === "PREPARED" && item.preparedStock <= 0;
              const color = colorForCategory(item.category, categories);
              const inCart = cart[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  onClick={() => add(item.id)}
                  disabled={soldOut}
                  style={{
                    backgroundColor: soldOut ? "#eeeae5" : color.bg,
                    borderColor: soldOut ? "#ddd6ce" : color.border,
                  }}
                  className="relative flex h-28 flex-col justify-between rounded-xl border-2 p-3 text-left transition-transform active:scale-[0.97] disabled:cursor-not-allowed"
                >
                  {inCart > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white shadow">
                      {inCart}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[15px] font-bold leading-tight text-ink">
                    {item.name}
                  </span>
                  <span>
                    <span className="num block text-base font-bold text-ink">
                      {yen(item.salePrice)}
                    </span>
                    {item.stockMode === "PREPARED" && (
                      <span className="num block text-[11px] text-ink-muted">
                        {soldOut ? "売り切れ" : `残り${item.preparedStock}`}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="col-span-full py-12 text-center text-sm text-ink-muted">
                表示できるメニューがありません。「メニュー・レシピ」から登録してください。
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 注文パネル */}
      <div className="flex w-[340px] shrink-0 flex-col rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-bold">ご注文</span>
          <button
            onClick={clearCart}
            className="text-xs text-ink-muted underline hover:text-danger"
          >
            クリア
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {lines.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">
              商品をタップしてください
            </p>
          ) : (
            <div className="space-y-1">
              {lines.map((l) => (
                <div key={l.menuItemId} className="rounded-lg px-2 py-2 hover:bg-surface-hover">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{l.item.name}</span>
                    <button
                      onClick={() => removeLine(l.menuItemId)}
                      className="shrink-0 rounded p-0.5 text-ink-muted hover:text-danger"
                      aria-label="削除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => decrement(l.menuItemId)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-hover"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        value={l.quantity}
                        onChange={(e) => setQuantity(l.menuItemId, e.target.value)}
                        type="number"
                        min={0}
                        className="num h-7 w-12 rounded-md border border-border text-center text-sm"
                      />
                      <button
                        onClick={() => add(l.menuItemId)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-hover"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="num text-sm font-bold">
                      {yen(l.item.salePrice * l.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>点数</span>
            <span className="num">{itemCount}点</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-sm font-bold">合計</span>
            <span className="num text-3xl font-bold tracking-tight">{yen(total)}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
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
              className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-accent py-3 text-sm font-bold text-accent hover:bg-accent-weak disabled:opacity-40"
            >
              <CreditCard size={16} />
              カード
            </button>
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
              className="flex items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-bold text-white shadow-card disabled:opacity-40"
              style={{ backgroundColor: "#ef7b10" }}
            >
              <Banknote size={16} />
              現金で会計
            </button>
          </div>
        </div>
      </div>

      {showRecent && (
        <Modal open onOpenChange={(o) => !o && setShowRecent(false)} title="直近の取引">
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {recentSales.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded border border-border px-3 py-2 text-sm ${
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
              <p className="py-6 text-center text-xs text-ink-muted">まだ取引がありません。</p>
            )}
          </div>
        </Modal>
      )}

      {payMode === "cash" && (
        <PaymentDialog
          total={total}
          items={cartItems}
          receiptLines={receiptLines}
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
          items={cartItems}
          receiptLines={receiptLines}
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

function CategoryTab({
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
      className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors ${
        active
          ? "bg-ink text-white"
          : "border border-border bg-surface text-ink-muted hover:bg-surface-hover"
      }`}
    >
      {label}
    </button>
  );
}

// 預り金の入力。エアレジのように、よく使う金額のボタンと大きなテンキーで素早く入れる。
const QUICK_AMOUNTS = [1000, 5000, 10000];

function PaymentDialog({
  total,
  items,
  receiptLines,
  onClose,
  onSuccess,
}: {
  total: number;
  items: { menuItemId: string; quantity: number }[];
  receiptLines: ReceiptLine[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ change: number; receivedAmount: number; at: Date } | null>(
    null,
  );

  const receivedNum = Number(received || 0);
  const change = receivedNum - total;
  const enough = received !== "" && receivedNum >= total;

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
      setDone({
        change: receivedNum > 0 ? change : 0,
        receivedAmount: receivedNum > 0 ? receivedNum : total,
        at: new Date(),
      });
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
            <div className="rounded-lg bg-accent-weak py-3">
              <p className="text-xs text-accent">おつり</p>
              <p className="num text-3xl font-bold text-accent">{yen(done.change)}</p>
            </div>
          )}
          <div className="rounded border border-border bg-bg p-3">
            <Receipt
              lines={receiptLines}
              total={total}
              paymentMethod="CASH"
              received={done.receivedAmount}
              change={done.change}
              occurredAt={done.at}
            />
          </div>
          <button
            onClick={() => window.print()}
            className="w-full rounded-lg border border-accent py-2.5 text-sm font-bold text-accent hover:bg-accent-weak"
          >
            レシートを印刷
          </button>
          <button
            onClick={onSuccess}
            className="w-full rounded-lg py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: "#ef7b10" }}
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
        <div className="rounded-lg bg-surface-hover px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">お会計</span>
            <span className="num text-2xl font-bold">{yen(total)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs text-ink-muted">お預かり</span>
            <span className="num text-2xl font-bold">{received ? yen(receivedNum) : "¥0"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs text-ink-muted">
              {received && receivedNum < total ? "不足" : "おつり"}
            </span>
            <span
              className={`num text-2xl font-bold ${
                received && receivedNum < total ? "text-danger" : "text-accent"
              }`}
            >
              {received ? yen(Math.abs(change)) : "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setReceived(String(total))}
            className="rounded-lg border-2 border-accent py-2.5 text-xs font-bold text-accent hover:bg-accent-weak"
          >
            ちょうど
          </button>
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setReceived(String(a))}
              className="num rounded-lg border border-border py-2.5 text-xs font-bold hover:bg-surface-hover"
            >
              ¥{a.toLocaleString("ja-JP")}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => (
            <button
              key={k}
              onClick={() => (k === "⌫" ? setReceived((cur) => cur.slice(0, -1)) : pressDigit(k))}
              className="num rounded-lg border border-border py-3.5 text-lg font-bold hover:bg-surface-hover active:scale-95"
            >
              {k}
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-ink-muted">
          現金以外のときは、そのまま「会計する」を押してください
        </p>

        <button
          onClick={finalize}
          disabled={pending}
          className="w-full rounded-lg py-3.5 text-base font-bold text-white shadow-card disabled:opacity-50"
          style={{ backgroundColor: enough || received === "" ? "#ef7b10" : "#c9c1b8" }}
        >
          {pending ? "処理中…" : "会計する"}
        </button>
      </div>
    </Modal>
  );
}
