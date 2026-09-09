import { redirect } from "next/navigation";
import { requireAuth, getRole } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { getDaySummary, breakevenBadge } from "@/lib/day-summary";
import { prisma } from "@/lib/prisma";
import { NavRail } from "@/components/layout/NavRail";
import { AppHeader } from "@/components/layout/AppHeader";
import { DayBar } from "@/components/layout/DayBar";
import { ViewerModeBanner } from "@/components/layout/ViewerModeBanner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  const role = getRole();
  const event = await getCurrentEvent();
  if (!event) redirect("/select-event");

  const [summary, session] = await Promise.all([
    getDaySummary(event.id, event.dayIndex),
    prisma.dailyRegister.findUnique({
      where: { eventId_dayIndex: { eventId: event.id, dayIndex: event.dayIndex } },
    }),
  ]);

  const registerActive = !!session?.openedAt && !session?.closedAt;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg md:flex-row">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          event={event}
          daySales={summary.sales}
          badge={breakevenBadge(summary)}
          badgeReached={summary.over >= 0}
        />
        <DayBar days={event.dayList} dayIndex={event.dayIndex} registerActive={registerActive} />
        {role === "viewer" && <ViewerModeBanner />}
        <main className="min-h-0 flex-1 overflow-y-auto pb-[60px] md:pb-0">{children}</main>
      </div>
    </div>
  );
}
