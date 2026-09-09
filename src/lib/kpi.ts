// KPIの実績をどこから取るか。サーバーアクションのファイルには
// 非同期関数しか置けないため、表示用のラベルはここに分けている。
export type KpiSourceDTO =
  | "MANUAL"
  | "SALES"
  | "MARGIN"
  | "CUSTOMERS"
  | "UNIT_PRICE"
  | "UNITS"
  | "ATTACH_RATE"
  | "SURVEY_SCORE";

export const KPI_SOURCE_LABEL: Record<KpiSourceDTO, string> = {
  MANUAL: "手入力",
  SALES: "売上(自動)",
  MARGIN: "粗利(自動)",
  CUSTOMERS: "客数(自動)",
  UNIT_PRICE: "客単価(自動)",
  UNITS: "販売点数(自動)",
  ATTACH_RATE: "併売率%(自動)",
  SURVEY_SCORE: "満足度(自動)",
};

export const KPI_SOURCES: KpiSourceDTO[] = [
  "MANUAL",
  "SALES",
  "MARGIN",
  "CUSTOMERS",
  "UNIT_PRICE",
  "UNITS",
  "ATTACH_RATE",
  "SURVEY_SCORE",
];
