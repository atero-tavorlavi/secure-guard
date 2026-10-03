import { expect, test } from "bun:test"
import { renderReport } from "../../src/scanner/report"
import { row } from "../helpers/rows"

const stats = { checked: 10, blocked: 2, wouldBlock: 1, pending: 0, falsePositives: 1, blockRate: 0.2, series: [{ start: 0, count: 2 }], byAttackType: [{ label: "destructive_action", count: 2 }], byTool: [{ label: "bash", count: 2 }] }

test("report is a standalone page with KPIs, charts and escaped samples", () => {
  const html = renderReport({ stats, rows: [row({ args_json: JSON.stringify({ command: "<img src=x onerror=alert(1)>" }) })], rangeLabel: "Last 24 hours", generatedAt: Date.UTC(2026, 9, 3), bucketMs: 3_600_000 })
  expect(html.startsWith("<!doctype html>")).toBe(true)
  expect(html).toContain("Last 24 hours")
  expect(html).toContain(">10<")
  expect(html).toContain("20.0%")
  expect(html.match(/<svg/g)!.length).toBe(3)
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  expect(html).not.toContain("<img src=x")
  expect(html).not.toMatch(/<script/i)
  expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/)
})
