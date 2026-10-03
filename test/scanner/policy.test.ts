import { describe, expect, test } from "bun:test"
import { decide, failAction, finalFor, finalForOutcome } from "../../src/scanner/policy"

describe("decide", () => {
  test.each([
    [0.2, "monitor", "allow"], [0.2, "ask", "allow"], [0.2, "auto", "allow"],
    [0.85, "monitor", "log"], [0.85, "ask", "ask"], [0.85, "auto", "block"],
    [0.99, "monitor", "log"], [0.99, "ask", "ask"], [0.99, "auto", "block"],
  ] as const)("risk %d in %s -> %s", (risk, mode, action) => {
    expect(decide(risk, mode, 0.85)).toBe(action)
  })

  test("just below threshold allows", () => {
    expect(decide(0.8499, "auto", 0.85)).toBe("allow")
  })
})

describe("failAction", () => {
  test.each([
    [true, "auto", "allow"], [true, "ask", "allow"], [true, "monitor", "allow"],
    [false, "auto", "block"], [false, "ask", "block"], [false, "monitor", "log"],
  ] as const)("failOpen=%p mode=%s -> %s", (failOpen, mode, action) => {
    expect(failAction(failOpen, mode)).toBe(action)
  })
})

describe("finalFor", () => {
  test.each([
    ["allow", "tool-call", "allowed"], ["log", "tool-call", "allowed"], ["ask", "tool-call", "pending"],
    ["block", "tool-call", "blocked"], ["block", "user-prompt", "blocked"], ["block", "tool-output", "redacted"],
  ] as const)("%s on %s -> %s", (action, kind, final) => {
    expect(finalFor(action, kind)).toBe(final)
  })

  test("finalForOutcome redacts tool output", () => {
    expect(finalForOutcome("block", "tool-output")).toBe("redacted")
    expect(finalForOutcome("block", "tool-call")).toBe("blocked")
    expect(finalForOutcome("allow", "tool-output")).toBe("allowed")
  })
})
