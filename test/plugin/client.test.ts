import { afterAll, expect, test } from "bun:test"
import { ScannerClient, ScannerHttpError } from "../../src/plugin/client"

// Something answers on the scanner port but not with the scanner's JSON (another service,
// a proxy error page, a truncated body). That is never "unreachable", so failOpen never applies.
let reply: () => Response = () => new Response("")
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => reply() })
afterAll(() => server.stop(true))
const client = new ScannerClient(`http://127.0.0.1:${server.port}`, () => "t")
const req = { kind: "user-prompt" as const, sessionID: "s", userPrompt: "hi" }

test.each([
  ["non-JSON error page", () => new Response("<html>bad gateway</html>", { status: 502 }), 502],
  ["empty error body", () => new Response("", { status: 500 }), 500],
  ["unparsable 200", () => new Response("not json", { status: 200 }), 200],
  ["empty 200", () => new Response("", { status: 200 }), 200],
])("/scan with %s is a ScannerHttpError", async (_name, make, status) => {
  reply = make
  const err = await client.scan(req).catch((e) => e)
  expect(err).toBeInstanceOf(ScannerHttpError)
  expect(err.status).toBe(status)
})
