import { getSurveyData } from "./actions";
import { SurveyBoard } from "@/components/survey/SurveyBoard";
import { getRole } from "@/lib/auth";

export default async function SurveysPage() {
  const data = await getSurveyData();
  if (!data) return null;

  return <SurveyBoard data={data} readOnly={getRole() !== "full"} />;
}
