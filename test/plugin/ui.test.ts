import { expect, test } from "bun:test"
import { scannerUrl } from "../../src/plugin/client"
import { argsPreview, askToast, blockToast, downToast, openBrowser, redactToast } from "../../src/plugin/ui"

const r = { id: "abc1234567", verdict: "deny" as const, reason: "destructive action · critical · risk 0.97", risk: 0.97, attackType: "destructive_action" as const, severity: "critical" as const }

test("argsPreview picks the meaningful field", () => {
  expect(argsPreview("bash", { command: "rm -rf ~" })).toBe("rm -rf ~")
  expect(argsPreview("edit", { filePath: "/a/b.ts", oldString: "x" })).toBe("/a/b.ts")
  expect(argsPreview("webfetch", { url: "https://x.example" })).toBe("https://x.example")
  expect(argsPreview("glob", { pattern: "**/*.ts" })).toBe('{"pattern":"**/*.ts"}')
  expect(argsPreview("bash", { command: "y".repeat(200) })).toHaveLength(60)
})

test("toast texts", () => {
  expect(blockToast(r, "bash: rm -rf ~")).toEqual({ title: "🛡️ Secure Guard blocked", message: "bash: rm -rf ~ · destructive action · critical · risk 0.97", variant: "error", duration: 8000 })
  expect(askToast(r, "bash: rm -rf ~", "http://localhost:9000", true).message).toContain("Approve in the prompt or at http://localhost:9000")
  expect(askToast(r, "bash: rm -rf ~", "http://localhost:9000", false).message).toContain("/guard-allow abc1234567")
  expect(redactToast(r, "webfetch").variant).toBe("warning")
  expect(downToast("connection refused", false).message).toContain("blocking")
})

test("scannerUrl honours env and strips legacy /scan", () => {
  expect(scannerUrl({}, 9000)).toBe("http://127.0.0.1:9000")
  expect(scannerUrl({ PROMPT_GUARD_URL: "http://localhost:9100/scan" }, 9000)).toBe("http://localhost:9100")
  expect(scannerUrl({ SECURE_GUARD_URL: "http://127.0.0.1:9200/" }, 9000)).toBe("http://127.0.0.1:9200")
})

test("openBrowser with a missing opener reports failure instead of crashing the host", async () => {
  expect(await openBrowser("http://localhost:9000/", ["/nonexistent/secure-guard-opener"])).toBe(false)
  expect(await openBrowser("http://localhost:9000/", ["true"])).toBe(true)
})
