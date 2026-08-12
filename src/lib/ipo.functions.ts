import { createServerFn } from "@tanstack/react-start";

export const fetchIpoSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { getIpoSnapshot } = await import("./ipo-scraper.server");
  return await getIpoSnapshot();
});
