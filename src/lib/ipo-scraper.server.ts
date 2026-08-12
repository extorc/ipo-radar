import type { Board, GmpPoint, IpoRow, IpoSnapshot } from "./ipo-types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const BASE = "https://www.chittorgarh.com";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,*/*" },
  });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return await res.text();
}

function decode(input: string): string {
  return input
    .replace(/&#8377;/g, "₹")
    .replace(/&nbsp;/g, " ")
    .replace(/&minus;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)));
}

function toText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decode(stripped).replace(/\s+/g, " ").trim();
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "Mon, Aug 10, 2026" -> "2026-08-10" */
function parseLongDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(value);
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()];
  if (month === undefined) return null;
  return iso(Number(m[3]), month, Number(m[2]));
}

/** "30 Jul - 03 Aug" / "17 - 19 Aug" -> ISO end date (year inferred) */
function parseRangeEnd(range: string, today: Date): string | null {
  const tail = range.split("-").pop()?.trim() ?? "";
  const m = /(\d{1,2})\s*([A-Za-z]{3})/.exec(tail);
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (month === undefined) return null;
  let year = today.getUTCFullYear();
  const diff = month - today.getUTCMonth();
  if (diff > 6) year -= 1;
  if (diff < -6) year += 1;
  return iso(year, month, Number(m[1]));
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
}

/** Today's date in IST as ISO yyyy-mm-dd */
export function istToday(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return iso(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

type Candidate = { id: string; slug: string; name: string; rangeEnd: string | null };

function parseDashboard(html: string, today: string): Candidate[] {
  const out = new Map<string, Candidate>();
  const re =
    /<a[^>]*href="\/ipo\/([a-z0-9-]+)\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,400}?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  const todayDate = new Date(`${today}T00:00:00Z`);
  while ((m = re.exec(html))) {
    const slug = m[1]!;
    const id = m[2]!;
    const name = toText(m[3]!).trim();
    const tail = m[4]!;
    const rangeMatch = /float-end[^>]*>([^<]+)</.exec(tail);
    const rangeEnd = rangeMatch ? parseRangeEnd(decode(rangeMatch[1]!), todayDate) : null;
    if (!name) continue;
    if (rangeEnd && daysBetween(rangeEnd, today) < -12) continue;
    if (!out.has(id)) out.set(id, { id, slug, name, rangeEnd });
  }
  return [...out.values()];
}

type Detail = {
  open: string | null;
  close: string | null;
  listing: string | null;
  sizeCr: number | null;
  lotSize: number | null;
  gmpUrl: string | null;
};

function parseDetail(html: string): Detail {
  const text = toText(html);
  const pick = (label: string) => {
    const re = new RegExp(`${label}\\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\\s*[A-Za-z]{3}\\s+\\d{1,2},\\s*\\d{4})`);
    return parseLongDate(re.exec(text)?.[1]);
  };
  const lotMatch = /Lot Size\s+([\d,]+)\s*Shares/i.exec(text);
  const sizeMatch = /Total Issue Size[\s\S]{0,160}?₹\s*([\d,.]+)\s*Cr/.exec(text);
  const gmpMatch = /https:\/\/www\.investorgain\.com\/chr-gmp\/[a-z0-9-]+\/\d+/.exec(html);
  return {
    open: pick("IPO\\s+Open"),
    close: pick("IPO\\s+Close"),
    listing: pick("Listing"),
    sizeCr: sizeMatch ? Number(sizeMatch[1]!.replace(/,/g, "")) : null,
    lotSize: lotMatch ? Number(lotMatch[1]!.replace(/,/g, "")) : null,
    gmpUrl: gmpMatch ? `${gmpMatch[0]}/` : null,
  };
}

type SubResult = {
  weakestCategory: string | null;
  weakestSubscription: number | null;
  totalSubscription: number | null;
  subscriptions: Record<string, number>;
};

function parseSubscription(html: string): SubResult {
  const rows: Array<{ label: string; value: number }> = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const cells = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => toText(c[1]!));
    if (cells.length < 2) continue;
    const label = cells[0]!.replace(/\s+/g, " ").trim();
    const raw = cells[1]!.replace(/[x,]/g, "").trim();
    const value = Number(raw);
    if (!label || !Number.isFinite(value)) continue;
    rows.push({ label, value });
  }
  const find = (test: RegExp) => rows.find((r) => test.test(r.label));
  const retail = find(/^retail/i);
  const shni = find(/sNII/i);
  const bhni = find(/bNII/i);
  const nii = find(/^NII\b/i) ?? find(/non institutional/i);
  const total = find(/^total/i);

  const candidates: Array<{ label: string; value: number; display: number }> = [];
  if (retail) candidates.push({ label: "Retail", value: retail.value, display: retail.value });
  if (shni) candidates.push({ label: "SHNI", value: shni.value, display: shni.value });
  if (bhni) candidates.push({ label: "BHNI", value: bhni.value / 5, display: bhni.value });
  if (!shni && !bhni && nii) candidates.push({ label: "NII", value: nii.value, display: nii.value });

  let weakest: { label: string; value: number; display: number } | null = null;
  for (const c of candidates) if (!weakest || c.value < weakest.value) weakest = c;

  const subscriptions: Record<string, number> = {};
  for (const c of [retail, shni, bhni, nii]) {
    if (c) subscriptions[c.label] = c.value;
  }
  if (total) subscriptions["Total"] = total.value;

  return {
    weakestCategory: weakest?.label ?? null,
    weakestSubscription: weakest?.display ?? null,
    totalSubscription: total?.value ?? null,
    subscriptions,
  };
}

function parseGmp(html: string): { history: GmpPoint[]; gmpPercent: number | null } {
  const seen = new Map<string, number>();
  const re = /gmp_date\\?"\s*:\s*\\?"(\d{2})-(\d{2})-(\d{4})[\s\S]{0,40}?gmp\\?"\s*:\s*\\?"(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    const value = Number(m[4]);
    if (Number.isFinite(value) && !seen.has(date)) seen.set(date, value);
  }
  const history = [...seen.entries()]
    .map(([date, gmp]) => ({ date, gmp }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pctMatch = /gmp_percent_calc\\?":\\?"(-?[\d.]+)\\?"/.exec(html);
  return { history, gmpPercent: pctMatch ? Number(pctMatch[1]) : null };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildRow(
  candidate: Candidate,
  board: Board,
  today: string,
  errors: string[],
): Promise<IpoRow | null> {
  const detailUrl = `${BASE}/ipo/${candidate.slug}/${candidate.id}/`;
  let detail: Detail;
  try {
    detail = parseDetail(await get(detailUrl));
  } catch (error) {
    errors.push(`${candidate.name}: ${(error as Error).message}`);
    return null;
  }

  const reference = detail.close ?? candidate.rangeEnd;
  // keep only upcoming / open issues (exclude closed-but-not-yet-listed)
  if (!reference || daysBetween(reference, today) < 0) return null;


  const subscriptionUrl = `${BASE}/ipo_subscription/${candidate.slug}/${candidate.id}/`;
  const [sub, gmp] = await Promise.all([
    get(`https://www.chittorgarh.net/documents/subscription/${candidate.id}/subscriptions.html`)
      .then(parseSubscription)
      .catch(() => ({ weakestCategory: null, weakestSubscription: null, totalSubscription: null, subscriptions: {} })),
    detail.gmpUrl
      ? get(detail.gmpUrl)
          .then(parseGmp)
          .catch(() => ({ history: [] as GmpPoint[], gmpPercent: null }))
      : Promise.resolve({ history: [] as GmpPoint[], gmpPercent: null }),
  ]);

  const latest = gmp.history.at(-1) ?? null;

  return {
    id: candidate.id,
    name: candidate.name,
    board,
    detailUrl,
    subscriptionUrl,
    gmpUrl: detail.gmpUrl,
    open: detail.open,
    close: detail.close,
    listing: detail.listing,
    sizeCr: detail.sizeCr,
    lotSize: detail.lotSize,
    gmp: latest?.gmp ?? null,
    gmpPercent: gmp.gmpPercent,
    weakestCategory: sub.weakestCategory,
    weakestSubscription: sub.weakestSubscription,
    totalSubscription: sub.totalSubscription,
    subscriptions: sub.subscriptions,
    gmpHistory: gmp.history,
  };
}

let cache: { at: number; data: IpoSnapshot } | null = null;
const TTL_MS = 4 * 60 * 1000;

export async function getIpoSnapshot(): Promise<IpoSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const today = istToday();
  const errors: string[] = [];
  const boards: Board[] = ["mainboard", "sme"];

  const perBoard = await Promise.all(
    boards.map(async (board) => {
      try {
        const html = await get(`${BASE}/ipo/ipo_dashboard.asp?a=${board}`);
        return { board, candidates: parseDashboard(html, today).slice(0, 22) };
      } catch (error) {
        errors.push(`${board} dashboard: ${(error as Error).message}`);
        return { board, candidates: [] as Candidate[] };
      }
    }),
  );

  const jobs = perBoard.flatMap(({ board, candidates }) =>
    candidates.map((candidate) => ({ board, candidate })),
  );

  const rows = (await mapLimit(jobs, 8, ({ board, candidate }) => buildRow(candidate, board, today, errors)))
    .filter((row): row is IpoRow => row !== null)
    .sort((a, b) => (a.close ?? "9999").localeCompare(b.close ?? "9999"));

  const data: IpoSnapshot = { fetchedAt: new Date().toISOString(), rows, errors };
  cache = { at: Date.now(), data };
  return data;
}
