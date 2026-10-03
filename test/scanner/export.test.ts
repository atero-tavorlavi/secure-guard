import { expect, test } from "bun:test"
import { toCsv, toJson } from "../../src/scanner/export"
import { row } from "../helpers/rows"

test("CSV has a header, ISO times, quoted cells", () => {
  const csv = toCsv([row()])
  const [header, line] = csv.trim().split("\n")
  expect(header).toBe("id,time,session,kind,tool,risk,attack_type,severity,reason,mode,action,final,decided_by,decided_at,false_positive,args")
  expect(line).toContain("2026-10-03T12:00:00.000Z")
  expect(line).toContain('"{""command"":""rm -rf ~""}"')
})

test("CSV neutralises formula injection", () => {
  const csv = toCsv([row({ args_json: "=HYPERLINK(\"http://evil\")", reason: "+cmd", tool: "@x", session_id: "-1" })])
  expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  expect(csv).toContain(",'+cmd,")
  expect(csv).toContain(",'@x,")
  expect(csv).toContain(",'-1,")
})

test("JSON parses embedded JSON columns", () => {
  const parsed = JSON.parse(toJson([row()]))
  expect(parsed[0].args).toEqual({ command: "rm -rf ~" })
  expect(parsed[0].context.userPrompt).toBe("clean")
  expect(parsed[0].args_json).toBeUndefined()
})
