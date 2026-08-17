export function yen(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
