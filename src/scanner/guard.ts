import { randomBytes } from "node:crypto"
import type { ConfigStore } from "../shared/config"
import type { Action, Assessment, CheckRequest, DecidedBy, DecisionRow, GuardStatus, Outcome, Resolution, ScanResponse } from "../shared/types"
import type { EventHub } from "./events"
import { assess as layaAssess, type LayaOptions } from "./laya"
import { Pending } from "./pending"
import { decide, failAction, finalFor, finalForOutcome } from "./policy"
import { touchesGuard } from "./selfprotect"
import type { Store } from "./store"

export interface GuardDeps {
  config: ConfigStore
  store: Store
  hub: EventHub
  home: string
  assess?: (req: CheckRequest, opts: LayaOptions) => Promise<Assessment>
}

export type ResolveResult = { ok: true; row: DecisionRow } | { ok: false; status: 404 | 409; error: string }

export const newId = () => randomBytes(5).toString("hex")

const describe = (a: Assessment) => `${a.attackType.replace(/_/g, " ")} · ${a.severity} · risk ${a.risk.toFixed(2)}`

export class Guard {
  private pending: Pending
  private layaOk: boolean | null = null
  private assess: (req: CheckRequest, opts: LayaOptions) => Promise<Assessment>

  constructor(private deps: GuardDeps) {
    this.pending = new Pending((id) => this.expire(id))
    this.assess = deps.assess ?? layaAssess
  }

  async check(req: CheckRequest): Promise<ScanResponse> {
    const cfg = this.deps.config.get() // snapshot: a mode change mid-check does not apply to this check
    const createdAt = Date.now()
    let assessment: Assessment | null = null
    let action: Action
    let decidedBy: DecidedBy
    let reason: string

    const rule = touchesGuard(req, { port: cfg.port, home: this.deps.home })
    if (rule) {
      assessment = { risk: 1, attackType: "privilege_escalation", severity: "critical", answers: null, truncated: false, ms: 0 }
      action = decide(1, cfg.mode, cfg.threshold)
      decidedBy = "rule"
      reason = rule
    } else {
      try {
        assessment = await this.assess(req, cfg.laya)
        this.setLaya(true)
        action = decide(assessment.risk, cfg.mode, cfg.threshold)
        decidedBy = "laya"
        reason = describe(assessment)
      } catch (err) {
        this.setLaya(false)
        action = failAction(cfg.failOpen, cfg.mode)
        decidedBy = "fail-policy"
        reason = `LAYA unavailable (${(err as Error).message}); failing ${cfg.failOpen ? "open" : "closed"}`
      }
    }

    const final = finalFor(action, req.kind)
    const row = this.deps.store.insert({
      id: newId(),
      created_at: createdAt,
      session_id: req.sessionID,
      kind: req.kind,
      tool: req.tool ?? null,
      args_json: req.args === undefined ? null : JSON.stringify(req.args),
      context_json: JSON.stringify({ userPrompt: req.userPrompt ?? null, reasoning: req.reasoning ?? null, history: req.history ?? [], output: req.output ?? null }),
      risk: assessment?.risk ?? null,
      attack_type: assessment?.attackType ?? null,
      severity: assessment?.severity ?? null,
      answers_json: assessment?.answers ? JSON.stringify(assessment.answers) : null,
      reason,
      mode: cfg.mode,
      action,
      final,
      decided_by: decidedBy,
      expires_at: action === "ask" ? Date.now() + cfg.askTimeoutSec * 1000 : null,
      truncated: assessment?.truncated ? 1 : 0,
      laya_ms: assessment && decidedBy === "laya" ? assessment.ms : null,
    })
    if (action === "ask") this.pending.track(row.id, cfg.askTimeoutSec * 1000)
    this.deps.hub.broadcast({ type: "decision", row })

    return {
      id: row.id,
      verdict: final === "pending" ? "ask" : final === "allowed" ? "allow" : "deny",
      reason,
      risk: row.risk,
      attackType: row.attack_type,
      severity: row.severity,
    }
  }

  resolve(id: string, outcome: Outcome, by: DecidedBy): ResolveResult {
    const existing = this.deps.store.get(id)
    if (!existing) return { ok: false, status: 404, error: "no such decision" }
    const final = finalForOutcome(outcome, existing.kind)
    const row = this.deps.store.finalize(id, final, by)
    if (!row) return { ok: false, status: 409, error: `already decided by ${this.deps.store.get(id)!.decided_by}` }
    this.pending.settle(id, { final, decidedBy: by })
    this.deps.hub.broadcast({ type: "decision", row })
    return { ok: true, row }
  }

  async wait(id: string, timeoutMs: number): Promise<Resolution | "pending" | null> {
    const row = this.deps.store.get(id)
    if (!row) return null
    if (row.final !== "pending") return { final: row.final, decidedBy: row.decided_by }
    return (await this.pending.wait(id, timeoutMs)) ?? "pending"
  }

  status(session?: string): GuardStatus {
    const cfg = this.deps.config.get()
    return {
      mode: cfg.mode,
      threshold: cfg.threshold,
      laya: { ok: this.layaOk, url: cfg.laya.url, model: cfg.laya.model },
      counts: this.deps.store.counts(session),
    }
  }

  setLaya(ok: boolean): void {
    if (this.layaOk === ok) return
    this.layaOk = ok
    this.deps.hub.broadcast({ type: "laya", ok })
  }

  recoverStale(): number {
    const ids = this.deps.store.pendingIds()
    for (const id of ids) this.expire(id)
    return ids.length
  }

  stop(): void {
    this.pending.clear()
  }

  private expire(id: string): void {
    this.resolve(id, this.deps.config.get().askTimeoutDefault, "timeout")
  }
}
