import { getRegisterMenu, getRecentSales } from "./actions";
import { RegisterManager } from "@/components/register/RegisterManager";
import { getRole } from "@/lib/auth";

export default async function RegisterPage() {
  const [menuItems, recentSales] = await Promise.all([getRegisterMenu(), getRecentSales()]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">レジ</h1>
      <p className="mt-1 text-sm text-ink-muted">
        商品をタップしてカートに入れ、「会計する」で1件の取引として記録します。
      </p>
      <div className="mt-6">
        <RegisterManager
          menuItems={menuItems}
          recentSales={recentSales}
          readOnly={getRole() !== "full"}
        />
      </div>
    </div>
  );
}
