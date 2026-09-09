import { getRecipes } from "./actions";
import { RecipeManager } from "@/components/recipes/RecipeManager";
import { getRole } from "@/lib/auth";

export default async function RecipesPage() {
  const { products, ingredients } = await getRecipes();

  return (
    <RecipeManager
      products={products}
      ingredients={ingredients}
      readOnly={getRole() !== "full"}
    />
  );
}
