import { getEvents } from "./actions";
import { EventSelector } from "@/components/events/EventSelector";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SelectEventPage() {
  const events = await getEvents();

  return (
    <div className="min-h-screen px-4 py-12">
      <EventSelector
        events={events}
        readOnly={getRole() !== "full"}
      />
    </div>
  );
}
