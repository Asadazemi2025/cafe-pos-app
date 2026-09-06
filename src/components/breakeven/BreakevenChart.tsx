"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { yen } from "@/lib/money";
import type { BreakevenPoint } from "@/app/(app)/breakeven/actions";

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function BreakevenChart({ points }: { points: BreakevenPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="mb-1 text-sm font-bold">累計利益の推移</p>
        <p className="py-10 text-center text-sm text-ink-muted">
          まだ売上がありません。レジで会計すると、ここに推移が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="mb-1 text-sm font-bold">累計利益の推移</p>
      <p className="mb-3 text-xs text-ink-muted">
        0円のライン(点線)を上回ると黒字です。経費を引いた後の累計利益を表示しています。
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <AreaChart data={points} margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9e5e28" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#9e5e28" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7dfd5" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => fmtTime(Number(v))}
              tick={{ fontSize: 11 }}
              stroke="#8f8176"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#8f8176"
              tickFormatter={(v) => `¥${(Number(v) / 1000).toFixed(0)}k`}
              width={56}
            />
            <Tooltip
              formatter={(v) => yen(Number(v))}
              labelFormatter={(l) => fmtTime(Number(l))}
            />
            <ReferenceLine y={0} stroke="#c94a2e" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="cumulativeProfit"
              name="累計利益"
              stroke="#9e5e28"
              strokeWidth={2}
              fill="url(#profitFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
