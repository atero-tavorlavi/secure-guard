import { expect, test } from "bun:test"
import { TOOL_PERMISSION, planNativePrompt } from "../../src/plugin/permissions"

const sorted = (s: Set<string>) => [...s].sort()

test("no permission block: all three go native and are auto-answered", () => {
  const config: any = {}
  const plan = planNativePrompt(config)
  expect(sorted(plan.native)).toEqual(["bash", "edit", "webfetch"])
  expect(sorted(plan.autoReply)).toEqual(["bash", "edit", "webfetch"])
  expect(config.permission).toEqual({ edit: "ask", bash: "ask", webfetch: "ask" })
})

test("user's own ask is kept and never auto-answered; pattern maps opt the key out", () => {
  const config: any = { permission: { edit: "allow", bash: { "git *": "allow", "*": "ask" }, webfetch: "ask" } }
  const plan = planNativePrompt(config)
  expect(sorted(plan.native)).toEqual(["edit", "webfetch"])
  expect(sorted(plan.autoReply)).toEqual(["edit"])
  expect(config.permission).toEqual({ edit: "ask", bash: { "git *": "allow", "*": "ask" }, webfetch: "ask" })
})

test("agent-level allow is upgraded too, or it would bypass the prompt", () => {
  const config: any = { permission: { bash: "allow" }, agent: { build: { permission: { bash: "allow", edit: "deny" } }, plan: {} } }
  const plan = planNativePrompt(config)
  expect(plan.native.has("bash")).toBe(true)
  expect(plan.autoReply.has("bash")).toBe(true)
  expect(config.agent.build.permission).toEqual({ bash: "ask", edit: "deny" })
  expect(config.permission.bash).toBe("ask")
})

test("an agent-level pattern map opts the key out everywhere and changes nothing", () => {
  const config: any = { permission: { bash: "allow" }, agent: { build: { permission: { bash: { "*": "allow" } } } } }
  const plan = planNativePrompt(config)
  expect(plan.native.has("bash")).toBe(false)
  expect(config.permission.bash).toBe("allow")
})

test("tool to permission map", () => {
  expect(TOOL_PERMISSION["write"]).toBe("edit")
  expect(TOOL_PERMISSION["bash"]).toBe("bash")
  expect(TOOL_PERMISSION["glob"]).toBeUndefined()
})
