import type { ServerDeps } from "./server"
import { toCsv, toJson } from "./export"
import { chartsFor, renderReport } from "./report"
import type { Store } from "./store"

const HOUR = 3_600_000
const DAY = 24 * HOUR
export const RANGES = {
  "24h": { ms: DAY, bucketMs: HOUR, label: "Last 24 hours" },
  "7d": { ms: 7 * DAY, bucketMs: DAY, label: "Last 7 days" },
  "30d": { ms: 30 * DAY, bucketMs: DAY, label: "Last 30 days" },
} as const

export function rangeBounds(range: string, now = Date.now()) {
  if (range === "all") return { from: 0, to: now + 1, bucketMs: DAY, label: "All time" }
  const r = RANGES[range as keyof typeof RANGES]
  if (!r) return null
  const to = Math.ceil((now + 1) / r.bucketMs) * r.bucketMs
  return { from: to - r.ms, to, bucketMs: r.bucketMs, label: r.label }
}

export const makeRoutes = ({ store }: { store: Store }): ServerDeps["routes"] => (req, url) => {
  if (req.method !== "GET") return null
  const range = url.searchParams.get("range") ?? "24h"
  if (url.pathname === "/api/overview") {
    const b = range === "all" ? null : rangeBounds(range)
    if (!b) return Response.json({ error: "range must be 24h, 7d or 30d" }, { status: 400 })
    const stats = store.stats(b.from, b.to, b.bucketMs)
    return Response.json({ range, stats, charts: chartsFor(stats, b.bucketMs) })
  }
  if (url.pathname === "/api/export") {
    const b = rangeBounds(range)
    if (!b) return Response.json({ error: "range must be 24h, 7d, 30d or all" }, { status: 400 })
    const format = url.searchParams.get("format")
    const name = `secure-guard-${range}`
    const download = (body: string, type: string, ext: string) =>
      new Response(body, { headers: { "content-type": type, "content-disposition": `attachment; filename="${name}.${ext}"` } })
    if (format === "csv") return download(toCsv(store.list({ from: b.from, to: b.to, limit: 100_000 })), "text/csv; charset=utf-8", "csv")
    if (format === "json") return download(toJson(store.list({ from: b.from, to: b.to, limit: 100_000 })), "application/json", "json")
    if (format === "html") {
      const bucketMs = range === "all" ? DAY : b.bucketMs
      const from = range === "all" ? Math.max(0, b.to - 30 * DAY) : b.from
      const html = renderReport({ stats: store.stats(from, b.to, bucketMs), rows: store.list({ from: b.from, to: b.to, flagged: true, limit: 50 }), rangeLabel: b.label, generatedAt: Date.now(), bucketMs })
      return download(html, "text/html; charset=utf-8", "html")
    }
    return Response.json({ error: "format must be csv, json or html" }, { status: 400 })
  }
  return null
}
