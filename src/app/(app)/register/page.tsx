import { getRegisterMenu, getRecentSales } from "./actions";
import { RegisterManager } from "@/components/register/RegisterManager";
import { getRole } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";

export default async function RegisterPage() {
  const [menuItems, recentSales, currentEvent] = await Promise.all([
    getRegisterMenu(),
    getRecentSales(),
    getCurrentEvent(),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <h1 className="text-xl font-bold tracking-tight">レジ</h1>
        <span className="text-xs text-ink-muted">
          {currentEvent ? `${currentEvent.name}(${currentEvent.date})` : "イベント未選択"}
        </span>
      </div>
      <RegisterManager
        menuItems={menuItems}
        recentSales={recentSales}
        readOnly={getRole() !== "full"}
      />
    </div>
  );
}
