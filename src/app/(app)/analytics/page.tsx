import { getAnalytics } from "./actions";
import { AnalyticsBoard } from "@/components/analytics/AnalyticsBoard";

export default async function AnalyticsPage() {
  const data = await getAnalytics();
  if (!data) return null;

  return <AnalyticsBoard data={data} />;
}
