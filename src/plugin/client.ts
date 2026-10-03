import type { GuardConfig } from "../shared/config"
import type { CheckRequest, GuardStatus, HumanSource, Mode, Outcome, Resolution, ScanResponse } from "../shared/types"

type Env = Record<string, string | undefined>

// A reachable scanner answered with a non-200 status (bad request, body too large, auth
// problem, internal error, ...). Distinct from a network failure/timeout so callers never
// treat "the scanner looked at this and rejected it" the same as "the scanner is unreachable".
export class ScannerHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ScannerHttpError"
  }
}

export function scannerUrl(env: Env, port: number): string {
  const raw = env["SECURE_GUARD_URL"] ?? env["PROMPT_GUARD_URL"]
  if (!raw) return `http://127.0.0.1:${port}`
  return raw.replace(/\/scan\/?$/, "").replace(/\/+$/, "")
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export class ScannerClient {
  constructor(
    readonly baseUrl: string,
    private token: () => string | null,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<{ status: number; body: T | null }> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { "content-type": "application/json", "x-guard-token": this.token() ?? "" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    // An empty or non-JSON body is null, never a thrown SyntaxError: the server answered, so
    // it must not look like a network failure ("unreachable") to callers.
    return { status: res.status, body: parseJson(await res.text()) as T | null }
  }

  async scan(req: CheckRequest): Promise<ScanResponse> {
    const r = await this.call<ScanResponse & { error?: string }>("POST", "/scan", req, 60_000)
    if (r.status !== 200) throw new ScannerHttpError(r.status, r.body?.error ?? "no detail")
    if (!r.body) throw new ScannerHttpError(r.status, "the scanner's answer is not JSON")
    return r.body
  }

  async waitFor(id: string, deadlineMs: number): Promise<Resolution> {
    while (Date.now() < deadlineMs) {
      const r = await this.call<Resolution & { error?: string }>("GET", `/api/decisions/${id}/wait?timeoutMs=25000`, undefined, 35_000)
      if (r.status === 200 && r.body) return r.body
      if (r.status !== 202) throw new Error(`scanner answered ${r.status}: ${r.body?.error ?? "no detail"}`)
    }
    throw new Error("gave up waiting for a decision")
  }

  async decide(id: string, outcome: Outcome, by: HumanSource): Promise<{ ok: true } | { ok: false; error: string }> {
    const r = await this.call<{ error?: string }>("POST", `/api/decisions/${id}/decide`, { outcome, by })
    return r.status === 200 ? { ok: true } : { ok: false, error: r.body?.error ?? `HTTP ${r.status}` }
  }

  async status(session?: string): Promise<GuardStatus> {
    const r = await this.call<GuardStatus>("GET", `/api/status${session ? `?session=${encodeURIComponent(session)}` : ""}`)
    if (r.status !== 200 || !r.body) throw new Error(`scanner answered ${r.status}`)
    return r.body
  }

  async setMode(mode: Mode): Promise<GuardConfig> {
    const r = await this.call<GuardConfig & { error?: string }>("PUT", "/api/config", { mode })
    if (r.status !== 200 || !r.body) throw new Error(r.body?.error ?? `HTTP ${r.status}`)
    return r.body
  }
}
