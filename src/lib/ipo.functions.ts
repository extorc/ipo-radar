import { createServerFn } from "@tanstack/react-start";

export const fetchIpoSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { getIpoSnapshot } = await import("./ipo-scraper.server");
  return await getIpoSnapshot();
});

export const fetchRecentOfs = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchRecentOfs: fetchOfs } = await import("./ipo-scraper.server");
  return await fetchOfs();
});
