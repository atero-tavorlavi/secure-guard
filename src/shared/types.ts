export type CheckKind = "user-prompt" | "tool-call" | "tool-output"
export type Mode = "monitor" | "ask" | "auto"
export type Action = "allow" | "block" | "ask" | "log"
export type Final = "pending" | "allowed" | "blocked" | "redacted"
export type Settled = Exclude<Final, "pending">
export type Outcome = "allow" | "block"
export type DecidedBy = "laya" | "rule" | "fail-policy" | "opencode" | "dashboard" | "command" | "timeout"
export type HumanSource = "opencode" | "dashboard" | "command"
export type AttackType = "prompt_injection" | "data_exfiltration" | "destructive_action" | "privilege_escalation" | "none"
export type Severity = "low" | "medium" | "high" | "critical"

export interface HistoryTurn {
  role: string
  text: string
}

export interface CheckRequest {
  kind: CheckKind
  sessionID: string
  callID?: string
  tool?: string
  args?: unknown
  userPrompt?: string
  reasoning?: string // what the assistant produced after the user's prompt, before this tool call
  history?: HistoryTurn[]
  output?: string
}

export interface Assessment {
  risk: number
  attackType: AttackType
  severity: Severity
  answers: unknown
  truncated: boolean
  ms: number
}

export interface ScanResponse {
  id: string
  verdict: "allow" | "deny" | "ask"
  reason: string
  risk: number | null
  attackType: AttackType | null
  severity: Severity | null
}

export interface Resolution {
  final: Settled
  decidedBy: DecidedBy
}

export interface DecisionRow {
  id: string
  created_at: number
  session_id: string
  kind: CheckKind
  tool: string | null
  args_json: string | null
  context_json: string
  risk: number | null
  attack_type: AttackType | null
  severity: Severity | null
  answers_json: string | null
  reason: string
  mode: Mode
  action: Action
  final: Final
  decided_by: DecidedBy
  decided_at: number | null
  expires_at: number | null
  truncated: number
  false_positive: number
  laya_ms: number | null
}

export interface GuardStatus {
  mode: Mode
  threshold: number
  laya: { ok: boolean | null; url: string; model: string }
  counts: { checked: number; blocked: number; pending: number }
}

export type GuardEvent =
  | { type: "decision"; row: DecisionRow }
  | { type: "config"; config: unknown }
  | { type: "laya"; ok: boolean }
