import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// テストモードと本番モードの切り替え。
//
// テストモード中は
//   ・売上・経費・レジ・アンケートが「テスト用」として記録され、本番の数字に混ざらない
//   ・カード決済はStripeのテストキーを使うので、実際のお金は動かない
// 本番モードに戻すと、テスト中のデータは画面から消える(消えたのではなく、隠れているだけ)。
//
// 練習や動作確認はテストモードで行い、当日の朝に本番へ切り替える使い方を想定している。

const SINGLETON = "singleton";

export const getTestMode = cache(async (): Promise<boolean> => {
  const setting = await prisma.appSetting.findUnique({ where: { id: SINGLETON } });
  return setting?.testMode ?? false;
});

export async function setTestMode(testMode: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON, testMode },
    update: { testMode },
  });
}

/**
 * 売上・経費などの絞り込みに使う。
 * テストモード中はテスト用のデータ、本番モード中は本番のデータだけを見る。
 */
export async function currentDataScope(): Promise<{ isTest: boolean }> {
  return { isTest: await getTestMode() };
}
