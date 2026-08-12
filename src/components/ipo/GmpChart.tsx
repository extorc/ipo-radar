import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IpoRow } from "@/lib/ipo-types";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function label(date: string) {
  const [, m, d] = date.split("-");
  const month = new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return `${d} ${month}`;
}

export function GmpChart({ rows, title }: { rows: IpoRow[]; title: string }) {
  const { data, series } = useMemo(() => {
    const active = rows.filter((row) => row.gmpHistory.length > 0).slice(0, 10);
    const dates = [...new Set(active.flatMap((row) => row.gmpHistory.map((p) => p.date)))].sort();
    const points = dates.map((date) => {
      const entry: Record<string, string | number | null> = { date: label(date) };
      for (const row of active) {
        const point = row.gmpHistory.find((p) => p.date === date);
        if (point != null) {
          if (point.gmp === 0) {
            entry[row.name] = 0;
          } else if (row.gmp && row.gmpPercent) {
            entry[row.name] = Number(((point.gmp / row.gmp) * row.gmpPercent).toFixed(2));
          } else {
            entry[row.name] = null;
          }
        } else {
          entry[row.name] = null;
        }
      }
      return entry;
    });
    return { data: points, series: active.map((row) => row.name) };
  }, [rows]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Grey market premium (%), day-wise</p>
      <div className="mt-4 h-[300px] w-full">
        {series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No GMP history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, undefined]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {series.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={PALETTE[index % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
