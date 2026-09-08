import { getExpenses } from "./actions";
import { ExpenseManager } from "@/components/expenses/ExpenseManager";
import { getRole } from "@/lib/auth";

export default async function ExpensesPage() {
  const { rows, summary } = await getExpenses();

  return <ExpenseManager rows={rows} summary={summary} readOnly={getRole() !== "full"} />;
}
