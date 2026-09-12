"use server";

import { prisma } from "@/lib/prisma";
import { buildDayList, initialDayIndex } from "@/lib/event";
import { getTestMode } from "@/lib/app-mode";

// お客さまが回答するアンケート。合言葉なしで送信できる(店頭のQRから開く)。
// 受け取るのは選択式と自由記述だけで、個人が特定される情報は集めない。
export type SubmitResult = { ok: true } | { ok: false; message: string };

export async function submitSurvey(input: {
  eventId: string;
  satisfaction: number;
  repeatIntent?: number | null;
  ageGroup?: string;
  knownFrom?: string;
  favoriteItem?: string;
  comment?: string;
}): Promise<SubmitResult> {
  const satisfaction = Math.round(input.satisfaction);
  if (!(satisfaction >= 1 && satisfaction <= 5)) {
    return { ok: false, message: "満足度を選んでください。" };
  }

  const event = await prisma.event.findUnique({ where: { id: input.eventId } });
  if (!event) return { ok: false, message: "このアンケートは受付を終了しました。" };

  const start = event.date.toISOString().slice(0, 10);
  const dayList = buildDayList(start, event.days);
  // 回答した日を、そのイベントの何日目かに置き換えて保存する
  const dayIndex = Math.min(initialDayIndex(start, event.days), dayList.length - 1);

  await prisma.surveyResponse.create({
    data: {
      eventId: event.id,
      dayIndex,
      // テストモード中の回答は本番の集計に混ぜない
      isTest: await getTestMode(),
      satisfaction,
      repeatIntent:
        input.repeatIntent && input.repeatIntent >= 1 && input.repeatIntent <= 5
          ? Math.round(input.repeatIntent)
          : null,
      ageGroup: input.ageGroup?.trim() || null,
      knownFrom: input.knownFrom?.trim() || null,
      favoriteItem: input.favoriteItem?.trim() || null,
      comment: input.comment?.trim().slice(0, 1000) || null,
    },
  });

  return { ok: true };
}
