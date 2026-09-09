import { getCarryOverCandidates, getStock } from "./actions";
import { StockManager } from "@/components/stock/StockManager";
import { getRole } from "@/lib/auth";

export default async function StockPage() {
  const [{ rows, summary }, carryOver] = await Promise.all([
    getStock(),
    getCarryOverCandidates(),
  ]);

  return (
    <StockManager
      rows={rows}
      summary={summary}
      carryOver={carryOver}
      readOnly={getRole() !== "full"}
    />
  );
}
