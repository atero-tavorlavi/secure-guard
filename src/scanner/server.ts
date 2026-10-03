import type { Server } from "bun"
import { ConfigError, type ConfigStore } from "../shared/config"
import type { CheckRequest, GuardEvent, HumanSource } from "../shared/types"
import type { EventHub } from "./events"
import type { Guard } from "./guard"
import type { LogFilter, Store } from "./store"

export interface ServerDeps {
  guard: Guard
  store: Store
  config: ConfigStore
  hub: EventHub
  token: string
  dashboardHtml: string
  routes?: (req: Request, url: URL) => Promise<Response | null> | Response | null
}

const MAX_BODY = 10 * 1024 * 1024
const KINDS = ["user-prompt", "tool-call", "tool-output"]
const HUMAN: HumanSource[] = ["opencode", "dashboard", "command"]

const json = (body: unknown, status = 200) => Response.json(body, { status })
const error = (status: number, message: string) => json({ error: message }, status)

const isStr = (v: unknown) => typeof v === "string"
export function validCheck(b: any): b is CheckRequest {
  if (!b || typeof b !== "object" || !KINDS.includes(b.kind) || !isStr(b.sessionID) || b.sessionID === "") return false
  for (const k of ["callID", "tool", "userPrompt", "reasoning", "output"]) if (b[k] !== undefined && b[k] !== null && !isStr(b[k])) return false
  if (b.history !== undefined && !(Array.isArray(b.history) && b.history.every((t: any) => t && isStr(t.role) && isStr(t.text)))) return false
  return true
}

export function startServer(deps: ServerDeps, port: number): Server<undefined> {
  const sse = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const enc = new TextEncoder()
  const send = (chunk: string) => {
    const bytes = enc.encode(chunk)
    for (const c of sse) {
      try {
        c.enqueue(bytes)
      } catch {
        sse.delete(c)
      }
    }
  }
  deps.hub.subscribe((e: GuardEvent) => send(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`))
  const ping = setInterval(() => send(": ping\n\n"), 15_000)

  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    maxRequestBodySize: MAX_BODY * 2, // hard cap; the handler answers 413 above MAX_BODY
    idleTimeout: 120, // long-polls (25 s) and SSE (15 s pings) outlive Bun's 10 s default
    async fetch(req) {
      const url = new URL(req.url)
      const allowedHosts = [`127.0.0.1:${server.port}`, `localhost:${server.port}`]
      if (!allowedHosts.includes(req.headers.get("host") ?? "")) return error(403, "forbidden host")
      const origin = req.headers.get("origin")
      if (origin && !allowedHosts.some((h) => origin === `http://${h}`)) return error(403, "forbidden origin")

      if (req.method === "GET" && url.pathname === "/") {
        return new Response(deps.dashboardHtml, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" },
        })
      }
      if (req.method === "GET" && url.pathname === "/health") return json({ ok: true })

      const token = req.headers.get("x-guard-token") ?? (req.method === "GET" ? url.searchParams.get("token") : null)
      if (token !== deps.token) return error(401, "missing or wrong token")
      if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return error(413, "body too large (10 MB max)")

      try {
        return (await route(req, url)) ?? error(404, "not found")
      } catch (err) {
        if (err instanceof ConfigError) return error(400, err.message)
        if (err instanceof SyntaxError) return error(400, "body is not valid JSON")
        console.error("[secure-guard] request failed:", err)
        return error(500, (err as Error).message)
      }
    },
  })

  async function route(req: Request, url: URL): Promise<Response | null> {
    const { guard, store, config } = deps
    const p = url.pathname
    const m = p.match(/^\/api\/decisions\/([0-9a-z]+)(?:\/(wait|decide|false-positive))?$/)

    if (req.method === "POST" && p === "/scan") {
      const body = await req.json()
      if (!validCheck(body)) return error(400, "invalid check request")
      return json(await guard.check(body))
    }
    if (req.method === "GET" && p === "/api/status") return json(guard.status(url.searchParams.get("session") ?? undefined))
    if (req.method === "GET" && p === "/api/config") return json(config.get())
    if (req.method === "PUT" && p === "/api/config") {
      const updated = config.update(await req.json())
      deps.hub.broadcast({ type: "config", config: updated })
      return json(updated)
    }
    if (req.method === "GET" && p === "/api/decisions") {
      const q = url.searchParams
      const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined)
      const filter: LogFilter = {
        final: (q.get("final") as LogFilter["final"]) || undefined,
        flagged: q.get("flagged") === "1" || undefined,
        attackType: (q.get("attackType") as LogFilter["attackType"]) || undefined,
        tool: q.get("tool") || undefined,
        session: q.get("session") || undefined,
        q: q.get("q") || undefined,
        from: num("from"),
        to: num("to"),
        limit: num("limit"),
      }
      return json(store.list(filter))
    }
    if (m && req.method === "GET" && !m[2]) {
      const row = store.get(m[1]!)
      return row ? json(row) : error(404, "no such decision")
    }
    if (m && req.method === "GET" && m[2] === "wait") {
      const t = Number(url.searchParams.get("timeoutMs") ?? 25_000)
      const result = await guard.wait(m[1]!, Math.min(Math.max(Number.isFinite(t) ? t : 25_000, 1), 60_000))
      if (result === null) return error(404, "no such decision")
      if (result === "pending") return json({ final: "pending" }, 202)
      return json(result)
    }
    if (m && req.method === "POST" && m[2] === "decide") {
      const body = await req.json()
      if (body?.outcome !== "allow" && body?.outcome !== "block") return error(400, "outcome must be allow or block")
      if (!HUMAN.includes(body?.by)) return error(400, "by must be opencode, dashboard or command")
      const r = guard.resolve(m[1]!, body.outcome, body.by)
      return r.ok ? json(r.row) : error(r.status, r.error)
    }
    if (m && req.method === "POST" && m[2] === "false-positive") {
      const body = await req.json()
      if (typeof body?.value !== "boolean") return error(400, "value must be true or false")
      const row = store.setFalsePositive(m[1]!, body.value)
      if (!row) return error(400, "only blocked, redacted or would-block decisions can be marked")
      deps.hub.broadcast({ type: "decision", row })
      return json(row)
    }
    if (req.method === "GET" && p === "/events") {
      let ctrl!: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c
          sse.add(c)
          c.enqueue(enc.encode(": connected\n\n"))
        },
        cancel() {
          sse.delete(ctrl)
        },
      })
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } })
    }
    return deps.routes ? await deps.routes(req, url) : null
  }

  const stop = server.stop.bind(server)
  server.stop = ((closeActive?: boolean) => {
    clearInterval(ping)
    for (const c of sse) {
      try {
        c.close()
      } catch {}
    }
    sse.clear()
    return stop(closeActive)
  }) as typeof server.stop
  return server
}
