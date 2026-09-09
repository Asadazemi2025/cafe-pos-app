import { getKanri } from "./actions";
import { KanriBoard } from "@/components/kanri/KanriBoard";
import { getRole } from "@/lib/auth";

export default async function KanriPage() {
  const data = await getKanri();
  if (!data) return null;

  return <KanriBoard data={data} readOnly={getRole() !== "full"} />;
}
