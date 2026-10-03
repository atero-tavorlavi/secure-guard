import { expect, test } from "bun:test"
import { COMMAND_DEFS, parseCommand } from "../../src/plugin/commands"

test("defines the seven commands", () => {
  expect(Object.keys(COMMAND_DEFS).sort()).toEqual(["guard", "guard-allow", "guard-dashboard", "guard-deny", "guard-mode", "guard-off", "guard-on"])
})

test.each([
  ["guard", "", { name: "status" }],
  ["guard-mode", " auto ", { name: "mode", mode: "auto" }],
  ["guard-mode", "yolo", { name: "error", message: "usage: /guard-mode monitor|ask|auto" }],
  ["guard-allow", "abc1234567", { name: "decide", id: "abc1234567", outcome: "allow" }],
  ["guard-deny", "ABC1234567", { name: "decide", id: "abc1234567", outcome: "block" }],
  ["guard-allow", "", { name: "error", message: "usage: /guard-allow <id>" }],
  ["guard-allow", "../x", { name: "error", message: "usage: /guard-allow <id>" }],
  ["guard-dashboard", "", { name: "dashboard" }],
  ["guard-off", "", { name: "pause" }],
  ["guard-on", "", { name: "resume" }],
  ["review", "", null],
])("/%s %s", (command, args, expected) => {
  expect(parseCommand(command, args)).toEqual(expected as any)
})
