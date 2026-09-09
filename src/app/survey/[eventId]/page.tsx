import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SurveyForm } from "@/components/survey/SurveyForm";

export const dynamic = "force-dynamic";

// 店頭のQRコードから開く、お客さま向けのアンケート。
export default async function SurveyPage({ params }: { params: { eventId: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const items = await prisma.menuItem.findMany({
    where: { isTest: false, showInRegister: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <SurveyForm
      eventId={event.id}
      eventName={event.name}
      menuNames={items.map((i) => i.name)}
    />
  );
}
