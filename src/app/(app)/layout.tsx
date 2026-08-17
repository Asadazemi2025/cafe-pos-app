import { requireAuth, getRole } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { ViewerModeBanner } from "@/components/layout/ViewerModeBanner";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  const role = getRole();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {role === "viewer" && <ViewerModeBanner />}
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
