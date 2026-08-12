import { useMemo } from "react";
import type { IpoRow } from "@/lib/ipo-types";

function parseDate(isoStr: string | null) {
  if (!isoStr) return null;
  return new Date(`${isoStr}T00:00:00Z`).getTime();
}

function labelDate(isoStr: string | null) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d} ${new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function IpoGanttChart({ rows }: { rows: IpoRow[] }) {
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
    // Add a little buffer to max date so the last label fits
    const max = Math.max(...valid.map((r) => r.listingMs || r.closeMs!)) + 86400000;

    return { items: valid.slice(0, 15), min, max };
  }, [rows]);

  if (data.items.length === 0) return null;

  const range = data.max - data.min;
  const safeRange = range === 0 ? 1 : range;

  // Generate 5 timeline markers
  const markers = Array.from({ length: 5 }).map((_, i) => {
    const ms = data.min + (safeRange * i) / 4;
    const date = new Date(ms);
    return {
      pct: (i / 4) * 100,
      label: `${date.getUTCDate()} ${date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`,
    };
  });

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 mt-6">
      <h2 className="text-base font-semibold">IPO Timelines</h2>
      <p className="mt-0.5 text-xs text-muted-foreground mb-6">Open to Close, and Funds Blocked Phase</p>
      
      <div className="relative w-full">
        {/* Grid Background */}
        <div className="absolute inset-0 pt-2 flex justify-between pointer-events-none">
          {markers.map((m, i) => (
            <div key={i} className="h-full border-l border-border/50 border-dashed relative" style={{ left: 0 }}>
              <span className="absolute -top-6 -translate-x-1/2 text-[10px] text-muted-foreground">
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-4 pt-2 pb-4">
          {data.items.map((item) => {
            const openPct = ((item.openMs! - data.min) / safeRange) * 100;
            const closePct = ((item.closeMs! - data.min) / safeRange) * 100;
            const listingPct = item.listingMs ? ((item.listingMs - data.min) / safeRange) * 100 : closePct;

            return (
              <div key={item.id} className="relative z-10">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-medium truncate w-1/3">{item.name}</span>
                </div>
                <div className="relative h-2 bg-muted/30 rounded-full w-full overflow-visible">
                  {/* Subscription Phase */}
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
                  {/* Processing to Listing Phase */}
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
        
        {/* Legend */}
        <div className="flex gap-4 items-center justify-center pt-4 border-t border-border mt-2 text-xs text-muted-foreground">
           <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /> Open to Close</div>
           <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-accent" /> Funds Blocked (Close to Listing)</div>
        </div>
      </div>
    </section>
  );
}
