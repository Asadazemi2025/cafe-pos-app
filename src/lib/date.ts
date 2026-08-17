const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDayKey(date: Date): string {
  const d = new Date(date.getTime() + JST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayJST(): string {
  return jstDayKey(new Date());
}

// 指定したJSTの日付("YYYY-MM-DD")の、その日の開始・終了(UTC Date)を返す。
// Sale.occurredAtなどをその日の範囲で絞り込むのに使う。
export function jstDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
