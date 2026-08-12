import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchIpoSnapshot } from "@/lib/ipo.functions";
import { GmpChart } from "@/components/ipo/GmpChart";
import { IpoTable, ratioFor } from "@/components/ipo/IpoTable";
import { IpoGanttChart } from "@/components/ipo/IpoGanttChart";
import { cn } from "@/lib/utils";

const ipoQuery = queryOptions({
  queryKey: ["ipo-snapshot"],
  queryFn: () => fetchIpoSnapshot(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IPO Radar — Live Mainboard & SME IPO GMP Tracker" },
      {
        name: "description",
        content:
          "Track open and upcoming mainboard and SME IPOs: timeline, issue size, GMP, weakest subscription category and day-wise GMP charts.",
      },
      { property: "og:title", content: "IPO Radar — Live Mainboard & SME IPO GMP Tracker" },
      {
        property: "og:description",
        content:
          "Open and upcoming IPO timelines, issue size, GMP and subscription analytics in one sortable dashboard.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ipoQuery);
  },
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm" role="alert">
      Could not load IPO data: {error.message}
    </div>
  ),
});

type Filter = "all" | "mainboard" | "sme";

function Dashboard() {
  const { data, refetch, isFetching } = useSuspenseQuery(ipoQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [nowIst, setNowIst] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNowIst(new Date(Date.now() + 5.5 * 3600 * 1000));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(
    () => (filter === "all" ? data.rows : data.rows.filter((row) => row.board === filter)),
    [data.rows, filter],
  );

  const stats = useMemo(() => {
    const open = data.rows.filter(
      (row) => nowIst && row.open && row.close && row.open <= nowIst.toISOString().slice(0, 10) && row.close >= nowIst.toISOString().slice(0, 10),
    ).length;
    const signals = data.rows.filter((row) => ratioFor(row, nowIst) !== null).length;
    return [
      { label: "Tracked issues", value: String(data.rows.length) },
      { label: "Mainboard", value: String(data.rows.filter((r) => r.board === "mainboard").length) },
      { label: "SME", value: String(data.rows.filter((r) => r.board === "sme").length) },
      { label: "Open today", value: String(open) },
      { label: "Closing-day signals", value: String(signals) },
    ];
  }, [data.rows, nowIst]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Grey market intelligence
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold sm:text-3xl">IPO Radar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open and upcoming mainboard &amp; SME issues.
            </p>

          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
            Refresh
          </button>
        </header>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-surface px-4 py-3">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="num mt-1 text-2xl font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-surface p-1">
            {(["all", "mainboard", "sme"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
                  filter === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "sme" ? "SME" : option}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(data.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </p>
        </div>

        <div className="mt-4">
          <IpoTable rows={rows} nowIst={nowIst} />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Weakest subscription = lowest of Retail, SHNI (sNII) and BHNI (bNII). GMP / Sub. is shown
          only on an issue&apos;s closing day.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <GmpChart
            rows={data.rows.filter((row) => row.board === "mainboard")}
            title="Mainboard GMP trend"
          />
          <GmpChart rows={data.rows.filter((row) => row.board === "sme")} title="SME GMP trend" />
        </div>

        <IpoGanttChart rows={data.rows} />

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Data scraped live from chittorgarh.com and investorgain.com. GMP is indicative only and
          not investment advice.
        </footer>
      </div>
    </main>
  );
}
