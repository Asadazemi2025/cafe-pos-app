import { getIngredients } from "./actions";
import { IngredientManager } from "@/components/ingredients/IngredientManager";
import { getRole } from "@/lib/auth";

export default async function IngredientsPage() {
  const ingredients = await getIngredients();

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">材料・仕入れ</h1>
      <p className="mt-1 text-sm text-ink-muted">
        メニューの原価はここに登録した材料の単価とレシピから自動計算されます。仕入れのたびに単価を更新してください。
      </p>
      <div className="mt-6">
        <IngredientManager initialIngredients={ingredients} readOnly={getRole() !== "full"} />
      </div>
    </div>
  );
}
