import { getMenuItems, getIngredientOptions } from "./actions";
import { MenuItemManager } from "@/components/menu-items/MenuItemManager";
import { getRole } from "@/lib/auth";

export default async function MenuItemsPage() {
  const [menuItems, ingredientOptions] = await Promise.all([
    getMenuItems(),
    getIngredientOptions(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">メニュー・レシピ</h1>
      <p className="mt-1 text-sm text-ink-muted">
        メニューごとに材料の配合(レシピ)を登録すると、原価と粗利が自動で計算されます。
      </p>
      <div className="mt-6">
        <MenuItemManager
          initialMenuItems={menuItems}
          ingredientOptions={ingredientOptions}
          readOnly={getRole() !== "full"}
        />
      </div>
    </div>
  );
}
