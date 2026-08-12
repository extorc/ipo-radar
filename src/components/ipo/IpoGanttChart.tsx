import { useMemo, useState } from "react";
import type { IpoRow } from "@/lib/ipo-types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function parseDate(isoStr: string | null) {
  if (!isoStr) return null;
  return new Date(`${isoStr}T00:00:00Z`).getTime();
}

function labelDate(isoStr: string | null) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d} ${new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

function getIssuePrice(row: IpoRow) {
  if (row.gmp && row.gmpPercent) {
    return (row.gmp / row.gmpPercent) * 100;
  }
  if (row.board === "sme") return 130000 / (row.lotSize || 1000);
  return 14500 / (row.lotSize || 1);
}

function getAmountBlocked(row: IpoRow, cat: string) {
  if (!cat || cat === "None") return 0;
  const price = getIssuePrice(row);
  const lot = row.lotSize || 1;
  if (row.board === "sme") {
    if (cat === "Retail") return price * lot * 1;
    if (cat === "HNI") return price * lot * 2;
  } else {
    if (cat === "Retail") return price * lot * 1;
    if (cat === "SHNI") return price * lot * 14;
    if (cat === "BHNI") return price * lot * 70;
  }
  return 0;
}

export function IpoGanttChart({ rows }: { rows: IpoRow[] }) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  const data = useMemo(() => {
    const valid = rows
      .map((r) => ({
        ...r,
        openMs: parseDate(r.open),
        closeMs: parseDate(r.close),
        listingMs: parseDate(r.listing),
      }))
      .filter((r) => r.openMs && r.closeMs);

    if (valid.length === 0) return { items: [], min: 0, max: 0 };

    const min = Math.min(...valid.map((r) => r.openMs!));
    const max = Math.max(...valid.map((r) => r.listingMs || r.closeMs!)) + 86400000;

    return { items: valid.slice(0, 15), min, max };
  }, [rows]);

  const barChartData = useMemo(() => {
    if (data.items.length === 0) return [];
    const days: { date: string; amount: number }[] = [];
    let currentMs = data.min;
    while (currentMs <= data.max) {
      const d = new Date(currentMs);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      
      let totalBlocked = 0;
      for (const item of data.items) {
        const cat = selections[item.id];
        if (!cat || cat === "None") continue;
        if (item.closeMs && item.listingMs && currentMs >= item.closeMs && currentMs < item.listingMs) {
          totalBlocked += getAmountBlocked(item, cat);
        }
      }
      days.push({
        date: labelDate(iso),
        amount: totalBlocked,
      });
      currentMs += 86400000;
    }
    return days;
  }, [data, selections]);

  if (data.items.length === 0) return null;

  const range = data.max - data.min;
  const safeRange = range === 0 ? 1 : range;

  const markers = Array.from({ length: 5 }).map((_, i) => {
    const ms = data.min + (safeRange * i) / 4;
    const date = new Date(ms);
    return {
      pct: (i / 4) * 100,
      label: `${date.getUTCDate()} ${date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`,
    };
  });

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 h-full">
        <h2 className="text-base font-semibold">IPO Timelines</h2>
        <p className="mt-0.5 text-xs text-muted-foreground mb-6">Select your application category to see funds blocked</p>
        
        <div className="relative w-full">
          <div className="absolute inset-0 pt-2 flex justify-between pointer-events-none">
            {markers.map((m, i) => (
              <div key={i} className="h-full border-l border-border/50 border-dashed relative" style={{ left: 0 }}>
                <span className="absolute -top-6 -translate-x-1/2 text-[10px] text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-2 pb-4">
            {data.items.map((item) => {
              const openPct = ((item.openMs! - data.min) / safeRange) * 100;
              const closePct = ((item.closeMs! - data.min) / safeRange) * 100;
              const listingPct = item.listingMs ? ((item.listingMs - data.min) / safeRange) * 100 : closePct;

              return (
                <div key={item.id} className="relative z-10">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-medium truncate max-w-[65%]">{item.name}</span>
                    <select
                      className="text-[10px] py-0.5 px-1 rounded border border-border bg-surface text-muted-foreground outline-none"
                      value={selections[item.id] || "None"}
                      onChange={(e) => setSelections((s) => ({ ...s, [item.id]: e.target.value }))}
                    >
                      <option value="None">Skip</option>
                      <option value="Retail">Retail</option>
                      {item.board === "sme" ? (
                        <option value="HNI">HNI</option>
                      ) : (
                        <>
                          <option value="SHNI">sHNI</option>
                          <option value="BHNI">bHNI</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="relative h-2 bg-muted/30 rounded-full w-full overflow-visible">
                    <div
                      className="absolute top-0 bottom-0 bg-primary rounded-l-full"
                      style={{
                        left: `${openPct}%`,
                        width: `${Math.max(closePct - openPct, 0.5)}%`,
                        borderTopRightRadius: item.listingMs ? 0 : 9999,
                        borderBottomRightRadius: item.listingMs ? 0 : 9999,
                      }}
                      title={`Open: ${labelDate(item.open)} to Close: ${labelDate(item.close)}`}
                    />
                    {item.listingMs && item.listingMs >= item.closeMs! && (
                      <div
                        className="absolute top-0 bottom-0 bg-accent rounded-r-full"
                        style={{
                          left: `${closePct}%`,
                          width: `${Math.max(listingPct - closePct, 0.5)}%`,
                        }}
                        title={`Funds Blocked until Listing: ${labelDate(item.listing)}`}
                      >
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-accent rounded-full border-2 border-surface shadow-sm" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex gap-4 items-center justify-center pt-4 border-t border-border mt-2 text-xs text-muted-foreground">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /> Open to Close</div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-accent" /> Funds Blocked (Close to Listing)</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 h-full flex flex-col">
        <h2 className="text-base font-semibold">Funds Blocked Over Time</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Total required capital based on your selections</p>
        <div className="flex-1 mt-4 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} 
                width={60}
                tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`} 
              />
              <Tooltip 
                cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Blocked"]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
