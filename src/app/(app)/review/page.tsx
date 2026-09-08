import { getReview } from "./actions";
import { ReviewBoard } from "@/components/review/ReviewBoard";
import { getRole } from "@/lib/auth";

export default async function ReviewPage() {
  const data = await getReview();
  if (!data) return null;

  return <ReviewBoard data={data} readOnly={getRole() !== "full"} />;
}
