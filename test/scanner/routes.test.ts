import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startScanner, type RunningScanner } from "../../src/scanner/main"

let s: RunningScanner
beforeAll(async () => {
  s = await startScanner({ home: mkdtempSync(join(tmpdir(), "sg-routes-")), env: { SECURE_GUARD_MODE: "auto" }, port: 0, healthIntervalMs: 0, assess: async () => ({ risk: 0.99, attackType: "destructive_action", severity: "critical", answers: {}, truncated: false, ms: 1 }) })
  await fetch(s.url + "/scan", { method: "POST", headers: { "x-guard-token": s.token, "content-type": "application/json" }, body: JSON.stringify({ kind: "tool-call", sessionID: "s", tool: "bash", args: { command: "rm -rf ~" } }) })
})
afterAll(() => s.stop())
const get = (p: string) => fetch(`${s.url}${p}${p.includes("?") ? "&" : "?"}token=${s.token}`)

test("overview returns stats and three SVG charts", async () => {
  const body = await (await get("/api/overview?range=24h")).json()
  expect(body.stats.blocked).toBe(1)
  expect(body.charts.series).toStartWith("<svg")
  expect(body.charts.byAttackType).toContain("destructive_action")
  expect(body.charts.byTool).toContain("bash")
})

test("bad range is 400", async () => {
  expect((await get("/api/overview?range=1y")).status).toBe(400)
})

test.each([
  ["csv", "text/csv", "secure-guard-24h.csv"],
  ["json", "application/json", "secure-guard-24h.json"],
  ["html", "text/html", "secure-guard-24h.html"],
])("export %s", async (format, type, filename) => {
  const res = await get(`/api/export?format=${format}&range=24h`)
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toStartWith(type)
  expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${filename}"`)
  expect(await res.text()).toContain("rm -rf ~")
})
