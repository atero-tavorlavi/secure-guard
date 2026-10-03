import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Assessment } from "../../src/shared/types"
import { startScanner, type RunningScanner } from "../../src/scanner/main"

let s: RunningScanner
let risk = 0.1
const assess = async (): Promise<Assessment> => ({ risk, attackType: risk >= 0.5 ? "destructive_action" : "none", severity: "high", answers: {}, truncated: false, ms: 3 })

beforeAll(async () => {
  s = await startScanner({ home: mkdtempSync(join(tmpdir(), "sg-server-")), env: {}, port: 0, assess, healthIntervalMs: 0 })
})
afterAll(() => s.stop())

const api = (path: string, init: RequestInit = {}) =>
  fetch(s.url + path, { ...init, headers: { "content-type": "application/json", "x-guard-token": s.token, ...(init.headers ?? {}) } })
const scan = (body: unknown) => api("/scan", { method: "POST", body: JSON.stringify(body) })

describe("auth and origin", () => {
  test("API without token is 401", async () => {
    expect((await fetch(s.url + "/api/status")).status).toBe(401)
    expect((await fetch(s.url + "/scan", { method: "POST", body: "{}" })).status).toBe(401)
  })

  test("token in query works for GET only", async () => {
    expect((await fetch(`${s.url}/api/status?token=${s.token}`)).status).toBe(200)
    expect((await fetch(`${s.url}/api/config?token=${s.token}`, { method: "PUT", body: "{}" })).status).toBe(401)
  })

  test("foreign Host header is 403 even on / (DNS rebinding)", async () => {
    // Raw socket: fetch implementations may refuse to override Host.
    const reply = await new Promise<string>((resolve) => {
      let data = ""
      Bun.connect({
        hostname: "127.0.0.1",
        port: Number(new URL(s.url).port),
        socket: {
          open: (sock) => void sock.write("GET / HTTP/1.1\r\nHost: evil.example:9000\r\nConnection: close\r\n\r\n"),
          data: (_sock, chunk) => void (data += new TextDecoder().decode(chunk)),
          close: () => resolve(data),
        },
      })
    })
    expect(reply).toStartWith("HTTP/1.1 403")
  })

  test("foreign Origin is 403", async () => {
    expect((await api("/api/status", { headers: { origin: "https://evil.example" } })).status).toBe(403)
  })

  test("dashboard is served without the token (it arrives in the #token= fragment); health is open", async () => {
    const html = await (await fetch(s.url + "/")).text()
    expect(html).toContain("Secure Guard")
    expect(html).not.toContain(s.token)
    expect(html).not.toContain("__GUARD_TOKEN__")
    expect(await (await fetch(s.url + "/health")).json()).toEqual({ ok: true })
  })
})

describe("scan", () => {
  test("validates the body", async () => {
    expect((await scan({ kind: "nope", sessionID: "s" })).status).toBe(400)
    expect((await scan({ kind: "tool-call" })).status).toBe(400)
    expect((await scan({ kind: "tool-call", sessionID: "s", history: [{ role: 1 }] })).status).toBe(400)
    expect((await scan({ kind: "tool-call", sessionID: "s", reasoning: 42 })).status).toBe(400)
  })

  test("allow round trip", async () => {
    risk = 0.1
    const res = await scan({ kind: "tool-call", sessionID: "s1", tool: "bash", args: { command: "ls" } })
    expect(res.status).toBe(200)
    expect((await res.json()).verdict).toBe("allow")
  })

  test("accepts a 9 MB tool output, rejects 11 MB", async () => {
    risk = 0.1
    expect((await scan({ kind: "tool-output", sessionID: "s1", tool: "read", output: "x".repeat(9_000_000) })).status).toBe(200)
    expect((await scan({ kind: "tool-output", sessionID: "s1", tool: "read", output: "x".repeat(11_000_000) })).status).toBe(413)
  })
})

describe("ask flow over HTTP", () => {
  test("wait long-polls; decide wins once; second is 409", async () => {
    risk = 0.97
    const { id, verdict } = await (await scan({ kind: "tool-call", sessionID: "s1", tool: "bash", args: { command: "rm -rf ~" } })).json()
    expect(verdict).toBe("ask")
    const waiting = api(`/api/decisions/${id}/wait?timeoutMs=5000`)
    await Bun.sleep(20)
    const d1 = await api(`/api/decisions/${id}/decide`, { method: "POST", body: JSON.stringify({ outcome: "block", by: "dashboard" }) })
    expect(d1.status).toBe(200)
    expect(await (await waiting).json()).toEqual({ final: "blocked", decidedBy: "dashboard" })
    const d2 = await api(`/api/decisions/${id}/decide`, { method: "POST", body: JSON.stringify({ outcome: "allow", by: "opencode" }) })
    expect(d2.status).toBe(409)
    expect((await d2.json()).error).toBe("already decided by dashboard")
  })

  test("wait returns 202 when still pending", async () => {
    risk = 0.97
    const { id } = await (await scan({ kind: "tool-call", sessionID: "s1", tool: "bash", args: { command: "x" } })).json()
    expect((await api(`/api/decisions/${id}/wait?timeoutMs=10`)).status).toBe(202)
  })

  test("a long-poll outlives Bun's default 10 s idle timeout", async () => {
    risk = 0.97
    const { id } = await (await scan({ kind: "tool-call", sessionID: "s1", tool: "bash", args: { command: "y" } })).json()
    const res = await api(`/api/decisions/${id}/wait?timeoutMs=11000`)
    expect(res.status).toBe(202)
  }, 15000)

  test("decide validates outcome and source", async () => {
    expect((await api(`/api/decisions/x/decide`, { method: "POST", body: JSON.stringify({ outcome: "maybe", by: "dashboard" }) })).status).toBe(400)
    expect((await api(`/api/decisions/x/decide`, { method: "POST", body: JSON.stringify({ outcome: "allow", by: "laya" }) })).status).toBe(400)
    expect((await api(`/api/decisions/missing/decide`, { method: "POST", body: JSON.stringify({ outcome: "allow", by: "dashboard" }) })).status).toBe(404)
  })
})

describe("config, decisions, false positives, SSE", () => {
  test("PUT config validates and broadcasts", async () => {
    const bad = await api("/api/config", { method: "PUT", body: JSON.stringify({ mode: "yolo" }) })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toContain("mode")
    const ok = await api("/api/config", { method: "PUT", body: JSON.stringify({ mode: "auto" }) })
    expect((await ok.json()).mode).toBe("auto")
    await api("/api/config", { method: "PUT", body: JSON.stringify({ mode: "ask" }) })
  })

  test("decisions list filters and false-positive only on flagged rows", async () => {
    risk = 0.1
    const allowed = await (await scan({ kind: "tool-call", sessionID: "fp", tool: "bash", args: { command: "ls" } })).json()
    const rows = await (await api("/api/decisions?session=fp")).json()
    expect(rows.map((r: any) => r.id)).toEqual([allowed.id])
    const fp = await api(`/api/decisions/${allowed.id}/false-positive`, { method: "POST", body: JSON.stringify({ value: true }) })
    expect(fp.status).toBe(400)
  })

  test("SSE delivers a decision event", async () => {
    const res = await fetch(`${s.url}/events?token=${s.token}`)
    const reader = res.body!.getReader()
    risk = 0.1
    await scan({ kind: "user-prompt", sessionID: "sse", userPrompt: "hello" })
    let text = ""
    const deadline = Date.now() + 2000
    while (!text.includes("event: decision") && Date.now() < deadline) text += new TextDecoder().decode((await reader.read()).value)
    reader.cancel()
    expect(text).toContain("event: decision")
    expect(text).toContain('"session_id":"sse"')
  })
})
