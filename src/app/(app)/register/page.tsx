import { getRegisterMenu } from "./actions";
import { getSession } from "./session-actions";
import { RegisterManager } from "@/components/register/RegisterManager";
import { getRole } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";

export default async function RegisterPage() {
  const [products, session, event] = await Promise.all([
    getRegisterMenu(),
    getSession(),
    getCurrentEvent(),
  ]);

  const day = event?.dayList[event.dayIndex];

  return (
    <RegisterManager
      products={products}
      session={session}
      dayLabel={day?.date ?? ""}
      storeName={event?.name ?? "つむぐカフェ"}
      readOnly={getRole() !== "full"}
    />
  );
}
