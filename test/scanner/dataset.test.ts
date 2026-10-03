import { expect, test } from "bun:test"
import { datasetLine } from "../../src/scanner/dataset"
import { row } from "../helpers/rows"

const label = (line: string | null) => JSON.parse(JSON.parse(line!).messages[2].content).verdict

test("blocked -> deny, allowed -> allow, would-block -> deny", () => {
  expect(label(datasetLine(row()))).toBe("deny")
  expect(label(datasetLine(row({ final: "allowed", action: "allow" })))).toBe("allow")
  expect(label(datasetLine(row({ final: "allowed", action: "log" })))).toBe("deny")
})

test("false positive flips deny to allow", () => {
  expect(label(datasetLine(row({ false_positive: 1 })))).toBe("allow")
})

test("pending and fail-policy rows are skipped", () => {
  expect(datasetLine(row({ final: "pending" }))).toBeNull()
  expect(datasetLine(row({ decided_by: "fail-policy" }))).toBeNull()
})

test("user message carries the check context", () => {
  const msg = JSON.parse(datasetLine(row())!).messages[1].content
  expect(msg).toContain("[Check]\ntool-call")
  expect(msg).toContain("[User Prompt]\nclean")
  expect(msg).toContain('Arguments: {"command":"rm -rf ~"}')
})

test("a tool call carries the reasoning and recent turns that led to it", () => {
  const context_json = JSON.stringify({ userPrompt: "clean", reasoning: "Removing the build dir.", history: [{ role: "user", text: "hi" }, { role: "assistant", text: "hello" }], output: null })
  const msg = JSON.parse(datasetLine(row({ context_json }))!).messages[1].content
  expect(msg).toContain("[Reasoning]\nRemoving the build dir.")
  expect(msg).toContain("[Recent Turns]\nuser: hi\nassistant: hello")
  expect(msg.indexOf("[Recent Turns]")).toBeLessThan(msg.indexOf("[User Prompt]"))
  expect(msg.indexOf("[Reasoning]")).toBeLessThan(msg.indexOf("[Tool Call]"))
})
