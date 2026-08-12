export type Board = "mainboard" | "sme";

export type GmpPoint = {
  /** ISO date yyyy-mm-dd */
  date: string;
  gmp: number;
};

export type IpoRow = {
  id: string;
  name: string;
  board: Board;
  detailUrl: string;
  subscriptionUrl: string;
  gmpUrl: string | null;
  /** ISO dates */
  open: string | null;
  close: string | null;
  listing: string | null;
  /** issue size in ₹ crore */
  sizeCr: number | null;
  /** shares per lot */
  lotSize: number | null;
  gmp: number | null;
  gmpPercent: number | null;
  /** weakest of Retail / sNII (SHNI) / bNII (BHNI) */
  weakestCategory: string | null;
  weakestSubscription: number | null;
  totalSubscription: number | null;
  subscriptions: Record<string, number>;
  gmpHistory: GmpPoint[];
};

export type IpoSnapshot = {
  fetchedAt: string;
  rows: IpoRow[];
  errors: string[];
};
