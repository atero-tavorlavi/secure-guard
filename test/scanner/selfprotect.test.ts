import { expect, test } from "bun:test"
import { touchesGuard } from "../../src/scanner/selfprotect"

const guard = { port: 9000, home: "/Users/me/.secure-guard" }
const call = (args: unknown) => ({ kind: "tool-call" as const, sessionID: "s", tool: "bash", args })

test.each([
  [{ command: "curl -X PUT localhost:9000/api/config -d '{\"mode\":\"monitor\"}'" }],
  [{ command: "curl http://127.0.0.1:9000/" }],
  [{ command: "cat ~/.secure-guard/token" }],
  [{ filePath: "/Users/me/.secure-guard/config.json", content: "{}" }],
  [{ nested: { list: ["x", "wget [::1]:9000/events"] } }],
  [{ command: "type C:\\Users\\me\\.secure-guard\\token" }],
  [{ command: "curl -H 'Host: x' http://127.1:9000/api/config" }],
  [{ command: "curl http://0x7f000001:9000/api/status" }],
  [{ url: "http://my-alias:9000" }],
  [{ command: "cp evil.js ~/.config/opencode/plugin/secure-guard.js" }],
  [{ filePath: "/opt/sg-data/secure-guard.db" }],
  [{ filePath: "/Users/me/.config/opencode/plugin/secure-guard.js" }],
  [{ command: "del %APPDATA%\\opencode\\plugin\\secure-guard.js" }],
])("flags %j", (args) => {
  expect(touchesGuard(call(args), guard)).toMatch(/Secure Guard/)
})

test.each([
  [{ command: "ls -la" }],
  [{ command: "curl localhost:3000" }],
  [{ command: "echo port 9000 is fine without a host" }],
  [{ command: "cat ~/secure-guard/README.md" }],
  [{ command: "cd /Users/me/secure-guard && bun test" }],
  [{ filePath: "/Users/me/secure-guard/src/plugin/index.ts" }],
])("ignores %j", (args) => {
  expect(touchesGuard(call(args), guard)).toBeNull()
})

test("only tool calls are checked", () => {
  expect(touchesGuard({ kind: "tool-output", sessionID: "s", output: "localhost:9000" }, guard)).toBeNull()
})
