import { expect, test } from "bun:test"
import { mkdtempSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { dashboardLink, ensureToken, readToken, tokenPath } from "../../src/shared/token"

test("ensureToken creates a 64-hex token with 0600 and reuses it", () => {
  const home = join(mkdtempSync(join(tmpdir(), "sg-token-")), "nested")
  const a = ensureToken(home)
  expect(a).toMatch(/^[0-9a-f]{64}$/)
  expect(statSync(tokenPath(home)).mode & 0o777).toBe(0o600)
  expect(ensureToken(home)).toBe(a)
  expect(readToken(home)).toBe(a)
})

test("a short or empty token file is replaced", () => {
  const home = mkdtempSync(join(tmpdir(), "sg-token-"))
  writeFileSync(tokenPath(home), "short")
  expect(ensureToken(home)).toMatch(/^[0-9a-f]{64}$/)
})

test("readToken returns null when missing", () => {
  expect(readToken(mkdtempSync(join(tmpdir(), "sg-token-")))).toBeNull()
})

test("dashboardLink carries the token in the fragment and uses localhost", () => {
  expect(dashboardLink("http://127.0.0.1:9000", "ab12")).toBe("http://localhost:9000/#token=ab12")
  expect(dashboardLink("http://localhost:9100", null)).toBe("http://localhost:9100/")
})
