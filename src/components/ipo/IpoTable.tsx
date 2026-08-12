import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from "lucide-react";
import type { IpoRow } from "@/lib/ipo-types";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

type SortKey =
  | "name"
  | "open"
  | "close"
  | "listing"
  | "sizeCr"
  | "gmpPercent"
  | "weakestSubscription"
  | "ratio";

type Props = {
  rows: IpoRow[];
  /** IST "now", null until hydrated */
  nowIst: Date | null;
};

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "name", label: "IPO" },
  { key: "open", label: "Open" },
  { key: "close", label: "Close" },
  { key: "listing", label: "Listing", align: "right" },
  { key: "sizeCr", label: "Size (₹ Cr)", align: "right" },
  { key: "gmpPercent", label: "GMP (%)", align: "right" },
  { key: "weakestSubscription", label: "Weakest sub.", align: "right" },
  { key: "ratio", label: "GMP / Sub. (₹)", align: "right" },
];

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  const month = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return `${d} ${month}`;
}

const ROW_TINTS: Record<string, string> = {
  Retail: "bg-cat-retail/35",
  SHNI: "bg-cat-shni/35",
  BHNI: "bg-cat-bhni/35",
  NII: "bg-cat-nii/35",
};

function catRowTint(category: string) {
  return ROW_TINTS[category];
}

function fmtNum(value: number | null, digits = 2) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

/** lots per application used for the GMP/Sub calc, by weakest category */
const LOTS: Record<string, number> = { Retail: 1, SHNI: 14, BHNI: 14 * 5, NII: 14 };

export const CATEGORY_STYLES: Record<string, string> = {
  Retail: "bg-cat-retail text-cat-retail-foreground",
  SHNI: "bg-cat-shni text-cat-shni-foreground",
  BHNI: "bg-cat-bhni text-cat-bhni-foreground",
  NII: "bg-cat-nii text-cat-nii-foreground",
};

export function ratioFor(row: IpoRow, nowIst: Date | null): number | null {
  if (!nowIst || !row.close || row.gmp === null || !row.weakestSubscription) return null;
  if (!row.lotSize || !row.weakestCategory) return null;
  const lots = LOTS[row.weakestCategory];
  if (!lots) return null;
  const todayIst = nowIst.toISOString().slice(0, 10);
  if (row.close !== todayIst) return null;
  return (row.gmp * row.lotSize * lots) / row.weakestSubscription;
}

export function IpoTable({ rows, nowIst }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "close", dir: 1 });

  const sorted = useMemo(() => {
    const value = (row: IpoRow): string | number | null => {
      if (sort.key === "ratio") return ratioFor(row, nowIst);
      return row[sort.key] as string | number | null;
    };
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
  }, [rows, sort, nowIst]);

  const toggle = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/70">
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
                      active && "text-foreground",
                    )}
                  >
                    {col.align === "right" ? null : <span>{col.label}</span>}
                    <Icon className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    {col.align === "right" ? <span>{col.label}</span> : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const ratio = ratioFor(row, nowIst);
            const isOpen =
              nowIst &&
              row.open &&
              row.close &&
              nowIst.toISOString().slice(0, 10) >= row.open &&
              nowIst.toISOString().slice(0, 10) <= row.close;

            return (
              <tr
                key={`${row.board}-${row.id}`}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  row.board === "sme" && row.gmpPercent === 0 && isOpen
                    ? "bg-red-500/5"
                    : row.weakestCategory
                      ? catRowTint(row.weakestCategory)
                      : undefined,
                )}
              >
                <td className="max-w-[280px] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                        row.board === "sme"
                          ? "bg-accent/15 text-accent-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {row.board === "sme" ? "SME" : "MB"}
                    </span>
                    <a
                      href={row.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-foreground hover:text-accent"
                    >
                      {row.name}
                    </a>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </td>
                <td className="num px-4 py-3 text-muted-foreground">{fmtDate(row.open)}</td>
                <td className="num px-4 py-3 font-medium">{fmtDate(row.close)}</td>
                <td className="num px-4 py-3 text-right text-muted-foreground">
                  {fmtDate(row.listing)}
                </td>
                <td className="num px-4 py-3 text-right">
                  {row.sizeCr === null ? "—" : row.sizeCr.toLocaleString("en-IN")}
                </td>
                <td
                  className={cn(
                    "num px-4 py-3 text-right font-medium",
                    row.gmpPercent !== null && row.gmpPercent > 0 && "text-positive",
                    row.gmpPercent !== null && row.gmpPercent < 0 && "text-negative",
                  )}
                >
                  {row.gmpPercent === null ? "—" : `${row.gmpPercent}%`}
                </td>
                <td className="num px-4 py-3 text-right">
                  {row.weakestSubscription === null ? (
                    "—"
                  ) : isOpen && row.subscriptions && Object.keys(row.subscriptions).length > 0 ? (
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <a
                          href={row.subscriptionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-accent cursor-pointer"
                        >
                          {fmtNum(row.weakestSubscription)}x
                          <span
                            className={cn(
                              "ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                              (row.weakestCategory && CATEGORY_STYLES[row.weakestCategory]) ??
                                "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.weakestCategory}
                          </span>
                        </a>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-40 px-3 py-2 text-left shadow-xl">
                        <div className="flex flex-col gap-1.5">
                          {Object.entries(row.subscriptions).map(([cat, val]) => (
                            <div key={cat} className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground font-medium">{cat}</span>
                              <span className="font-semibold">{fmtNum(val)}x</span>
                            </div>
                          ))}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <a
                      href={row.subscriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent"
                    >
                      {fmtNum(row.weakestSubscription)}x
                      <span
                        className={cn(
                          "ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                          (row.weakestCategory && CATEGORY_STYLES[row.weakestCategory]) ??
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {row.weakestCategory}
                      </span>
                    </a>
                  )}
                </td>
                <td className="num px-4 py-3 text-right font-medium">
                  {ratio === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    `₹${Math.round(ratio).toLocaleString("en-IN")}`
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
