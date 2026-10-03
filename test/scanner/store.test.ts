import { beforeEach, describe, expect, test } from "bun:test"
import { Store, isFlagged, type NewDecision } from "../../src/scanner/store"

let store: Store
let n = 0
const HOUR = 3_600_000
const T0 = Date.UTC(2026, 9, 3, 0, 0, 0)

const make = (over: Partial<NewDecision> = {}): NewDecision => ({
  id: `d${++n}`,
  created_at: T0,
  session_id: "s1",
  kind: "tool-call",
  tool: "bash",
  args_json: JSON.stringify({ command: "ls" }),
  context_json: JSON.stringify({ userPrompt: "x", history: [], output: null }),
  risk: 0.1,
  attack_type: "none",
  severity: "low",
  answers_json: null,
  reason: "none · low · risk 0.10",
  mode: "ask",
  action: "allow",
  final: "allowed",
  decided_by: "laya",
  expires_at: null,
  truncated: 0,
  laya_ms: 30,
  ...over,
})

beforeEach(() => {
  store = new Store(":memory:")
})

test("insert sets decided_at for settled rows and null for pending", () => {
  expect(store.insert(make()).decided_at).toBe(T0)
  expect(store.insert(make({ final: "pending", action: "ask" })).decided_at).toBeNull()
})

test("finalize is first-wins", () => {
  const row = store.insert(make({ id: "p", final: "pending", action: "ask" }))
  expect(store.finalize(row.id, "blocked", "dashboard", T0 + 5)).toMatchObject({ final: "blocked", decided_by: "dashboard", decided_at: T0 + 5 })
  expect(store.finalize(row.id, "allowed", "opencode")).toBeNull()
  expect(store.get("p")!.decided_by).toBe("dashboard")
})

test("list filters and orders newest first", () => {
  store.insert(make({ id: "a", created_at: T0, tool: "bash" }))
  store.insert(make({ id: "b", created_at: T0 + 1, tool: "edit", final: "blocked", action: "block", attack_type: "destructive_action" }))
  store.insert(make({ id: "c", created_at: T0 + 2, tool: "bash", session_id: "s2", args_json: JSON.stringify({ command: "curl 100%_x" }) }))
  expect(store.list().map((r) => r.id)).toEqual(["c", "b", "a"])
  expect(store.list({ final: "blocked" }).map((r) => r.id)).toEqual(["b"])
  expect(store.list({ attackType: "destructive_action" }).map((r) => r.id)).toEqual(["b"])
  expect(store.list({ tool: "bash" }).map((r) => r.id)).toEqual(["c", "a"])
  expect(store.list({ session: "s2" }).map((r) => r.id)).toEqual(["c"])
  expect(store.list({ q: "100%_" }).map((r) => r.id)).toEqual(["c"])
  expect(store.list({ q: "%" }).map((r) => r.id)).toEqual(["c"])
  expect(store.list({ from: T0 + 1, to: T0 + 2 }).map((r) => r.id)).toEqual(["b"])
  expect(store.list({ limit: 1 }).map((r) => r.id)).toEqual(["c"])
})

test("flagged filter = blocked, redacted, or would-block", () => {
  store.insert(make({ id: "allow" }))
  store.insert(make({ id: "log", action: "log" }))
  store.insert(make({ id: "red", kind: "tool-output", final: "redacted", action: "block" }))
  expect(store.list({ flagged: true }).map((r) => r.id).sort()).toEqual(["log", "red"])
  expect(isFlagged(store.get("log")!)).toBe(true)
  expect(isFlagged(store.get("allow")!)).toBe(false)
})

test("false positive only on flagged rows", () => {
  store.insert(make({ id: "allow" }))
  store.insert(make({ id: "blk", final: "blocked", action: "block" }))
  expect(store.setFalsePositive("allow", true)).toBeNull()
  expect(store.setFalsePositive("blk", true)!.false_positive).toBe(1)
  expect(store.setFalsePositive("blk", false)!.false_positive).toBe(0)
})

test("counts per session and globally", () => {
  store.insert(make({ session_id: "s1" }))
  store.insert(make({ session_id: "s1", final: "blocked", action: "block" }))
  store.insert(make({ session_id: "s2", final: "pending", action: "ask" }))
  expect(store.counts()).toEqual({ checked: 3, blocked: 1, pending: 1 })
  expect(store.counts("s1")).toEqual({ checked: 2, blocked: 1, pending: 0 })
})

test("stats buckets blocks per hour and breaks them down", () => {
  store.insert(make({ created_at: T0 + 10, final: "blocked", action: "block", attack_type: "destructive_action", tool: "bash" }))
  store.insert(make({ created_at: T0 + HOUR + 10, final: "blocked", action: "block", attack_type: "destructive_action", tool: "bash" }))
  store.insert(make({ created_at: T0 + HOUR + 20, kind: "user-prompt", tool: null, final: "blocked", action: "block", attack_type: "prompt_injection" }))
  store.insert(make({ created_at: T0 + HOUR + 30, action: "log" }))
  store.insert(make({ created_at: T0 + 2 * HOUR }))
  const s = store.stats(T0, T0 + 3 * HOUR, HOUR)
  expect(s).toMatchObject({ checked: 5, blocked: 3, wouldBlock: 1, pending: 0, falsePositives: 0 })
  expect(s.blockRate).toBeCloseTo(0.6)
  expect(s.series).toEqual([{ start: T0, count: 1 }, { start: T0 + HOUR, count: 2 }, { start: T0 + 2 * HOUR, count: 0 }])
  expect(s.byAttackType).toEqual([{ label: "destructive_action", count: 2 }, { label: "prompt_injection", count: 1 }])
  expect(s.byTool).toEqual([{ label: "bash", count: 2 }, { label: "user-prompt", count: 1 }])
})

test("prune keeps pending rows", () => {
  const old = T0 - 40 * 24 * HOUR
  store.insert(make({ id: "old", created_at: old }))
  store.insert(make({ id: "oldpending", created_at: old, final: "pending", action: "ask" }))
  store.insert(make({ id: "new" }))
  expect(store.prune(30, T0)).toBe(1)
  expect(store.list().map((r) => r.id).sort()).toEqual(["new", "oldpending"])
  expect(store.pendingIds()).toEqual(["oldpending"])
})
