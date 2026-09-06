import { requireAuth, getRole } from "@/lib/auth";
import { getCurrentEvent } from "@/lib/event";
import { Sidebar } from "@/components/layout/Sidebar";
import { ViewerModeBanner } from "@/components/layout/ViewerModeBanner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  const role = getRole();
  const currentEvent = await getCurrentEvent();

  return (
    <div className="flex min-h-screen">
      <Sidebar currentEvent={currentEvent} />
      <div className="flex min-w-0 flex-1 flex-col">
        {role === "viewer" && <ViewerModeBanner />}
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
