import { getDailyRegister, getCurrentExpectedCash } from "./actions";
import { DailyRegisterManager } from "@/components/daily/DailyRegisterManager";
import { getRole } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { todayJST } from "@/lib/date";

export default async function DailyPage() {
  const [register, currentExpectedCash, currentEvent] = await Promise.all([
    getDailyRegister(),
    getCurrentExpectedCash(),
    getCurrentEvent(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">レジ初め・締め</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {currentEvent ? `${currentEvent.name}(${currentEvent.date})` : "イベント未選択"}
        のレジです。開店前に釣り銭を数えて記録し、閉店後に実際の現金と照合します(現金の会計のみが対象)。
      </p>
      <div className="mt-6">
        <DailyRegisterManager
          day={currentEvent?.date ?? todayJST()}
          initialRegister={register}
          currentExpectedCash={currentExpectedCash}
          readOnly={getRole() !== "full"}
        />
      </div>
    </div>
  );
}
