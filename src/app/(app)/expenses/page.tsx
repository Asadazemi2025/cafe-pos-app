import { getExpenses } from "./actions";
import { ExpenseManager } from "@/components/expenses/ExpenseManager";
import { getRole } from "@/lib/auth";

export default async function ExpensesPage() {
  const expenses = await getExpenses();

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">経費</h1>
      <p className="mt-1 text-sm text-ink-muted">
        材料以外の支出(消耗品・備品など)を記録します。レジ締めの現金過不足の計算にも使われます。
      </p>
      <div className="mt-6">
        <ExpenseManager initialExpenses={expenses} readOnly={getRole() !== "full"} />
      </div>
    </div>
  );
}
