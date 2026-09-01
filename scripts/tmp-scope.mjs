import { readFileSync, writeFileSync } from "node:fs";

// ── 1. compute recognition inside useFinancialReports ────────────────────────
const f = "features/billing/useFinancialReports.ts";
let s = readFileSync(f, "utf8").split("\r\n").join("\n");

s = s.replace('  invoicesByStatus: Record<string, number>;\n}', () =>
`  invoicesByStatus: Record<string, number>;

  // ── Accrual ──
  /*
   * Cash and revenue must describe the SAME population, so recognition is
   * computed here from the same \`subscribers\` array every other figure on this
   * page uses. It was briefly computed in the page from useSubscribers instead,
   * which is permission-scoped — so an employee without canViewAll saw cash for
   * the whole business beside revenue for their own book alone. Two rows, one
   * screen, two different sets of people. Sharing the source makes that
   * impossible by construction rather than by discipline.
   */
  /** Earned this month to date, straight-line by day. */
  recognizedRevenueUSD: number;
  /** Collected for service not yet delivered — a liability, not profit. */
  deferredRevenueUSD: number;
  /** Subscribers with no start date or duration, so not recognisable. */
  unrecognizableCount: number;
}`);

s = s.replace('    return {\n      isLoading: subs.isLoading || payments.isLoading || refunds.isLoading,', () =>
`    const monthStart = today.slice(0, 8) + "01";
    const revenue = summarizeRevenue(subscribers, monthStart, today, today);

    return {
      isLoading: subs.isLoading || payments.isLoading || refunds.isLoading,`);

s = s.replace('      subscriberCount: subscribers.length,', () =>
`      subscriberCount: subscribers.length,

      recognizedRevenueUSD: revenue.recognizedUSD,
      deferredRevenueUSD:   revenue.deferredUSD,
      unrecognizableCount:  revenue.unrecognizable,`);

const anchor = s.match(/^import .*from "@\/lib\/subscriberLifecycle";$/m);
s = s.replace(anchor[0], () => anchor[0] + '\nimport { summarizeRevenue } from "@/lib/revenueRecognition";');
writeFileSync(f, s.split("\n").join("\r\n"));
console.log("  ✓ recognition now shares the reports' own population");

// ── 2. page reads it from there ──────────────────────────────────────────────
const p = "app/finance/page.tsx";
let g = readFileSync(p, "utf8").split("\r\n").join("\n");
g = g.replace(/\n  \/\*\n   \* Accrual figures[\s\S]*?const revenue = summarizeRevenue\(subscribers, monthStart, today, today\);\n/, () => "\n");
g = g.replace('import { useSubscribers } from "@/hooks/useSubscribers";\n', () => "");
g = g.replace('import { summarizeRevenue } from "@/lib/revenueRecognition";\n', () => "");
g = g.split("revenue.recognizedUSD").join("r.recognizedRevenueUSD");
g = g.split("revenue.deferredUSD").join("r.deferredRevenueUSD");
g = g.split("revenue.unrecognizable").join("r.unrecognizableCount");
writeFileSync(p, g.split("\n").join("\r\n"));
console.log("  ✓ finance page reads both rows from one source");
