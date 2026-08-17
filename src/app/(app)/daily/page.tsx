import { getDailyRegister, getCurrentExpectedCash } from "./actions";
import { DailyRegisterManager } from "@/components/daily/DailyRegisterManager";
import { getRole } from "@/lib/auth";
import { todayJST } from "@/lib/date";

export default async function DailyPage() {
  const day = todayJST();
  const [register, currentExpectedCash] = await Promise.all([
    getDailyRegister(day),
    getCurrentExpectedCash(day),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">レジ初め・締め</h1>
      <p className="mt-1 text-sm text-ink-muted">
        開店前に釣り銭を数えて記録し、閉店後に実際の現金と照合します(現金の会計のみが対象です)。
      </p>
      <div className="mt-6">
        <DailyRegisterManager
          day={day}
          initialRegister={register}
          currentExpectedCash={currentExpectedCash}
          readOnly={getRole() !== "full"}
        />
      </div>
    </div>
  );
}
