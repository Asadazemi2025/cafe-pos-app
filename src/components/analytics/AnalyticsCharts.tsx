"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { yen } from "@/lib/money";
import type { EventComparisonRow, MenuRankingRow } from "@/app/(app)/analytics/actions";

export function EventComparisonChart({ data }: { data: EventComparisonRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <p className="mb-3 text-sm font-bold">イベントごとの売上・粗利</p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">まだイベントの実績がありません。</p>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e7dfd5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#8f8176" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#8f8176"
                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip formatter={(v) => yen(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" name="売上" fill="#9e5e28" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="粗利" fill="#3a8a4c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function MenuRankingTable({ data }: { data: MenuRankingRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-ink-muted">
            <th className="px-4 py-2.5">メニュー</th>
            <th className="px-4 py-2.5">販売数</th>
            <th className="px-4 py-2.5">売上</th>
            <th className="px-4 py-2.5">粗利</th>
            <th className="px-4 py-2.5">粗利率</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.name} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium">
                {i === 0 && <span className="mr-1.5">🥇</span>}
                {i === 1 && <span className="mr-1.5">🥈</span>}
                {i === 2 && <span className="mr-1.5">🥉</span>}
                {row.name}
              </td>
              <td className="num px-4 py-2.5">{row.quantity.toLocaleString("ja-JP")}</td>
              <td className="num px-4 py-2.5">{yen(row.revenue)}</td>
              <td className="num px-4 py-2.5">{yen(row.profit)}</td>
              <td className="num px-4 py-2.5 text-ink-muted">{row.marginRate.toFixed(0)}%</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">
                このイベントの販売データがまだありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
