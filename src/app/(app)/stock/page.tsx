import { getStock } from "./actions";
import { StockManager } from "@/components/stock/StockManager";
import { getRole } from "@/lib/auth";

export default async function StockPage() {
  const { rows, summary } = await getStock();

  return <StockManager rows={rows} summary={summary} readOnly={getRole() !== "full"} />;
}
