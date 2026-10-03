import type { DecisionRow } from "../shared/types"

const HEADER = ["id", "time", "session", "kind", "tool", "risk", "attack_type", "severity", "reason", "mode", "action", "final", "decided_by", "decided_at", "false_positive", "args"]

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ""
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString())

export function toCsv(rows: DecisionRow[]): string {
  const lines = rows.map((r) =>
    [r.id, iso(r.created_at), r.session_id, r.kind, r.tool, r.risk, r.attack_type, r.severity, r.reason, r.mode, r.action, r.final, r.decided_by, iso(r.decided_at), r.false_positive, r.args_json]
      .map(cell)
      .join(","),
  )
  return [HEADER.join(","), ...lines].join("\n") + "\n"
}

const parse = (s: string | null) => (s === null ? null : JSON.parse(s))

export function toJson(rows: DecisionRow[]): string {
  return JSON.stringify(
    rows.map(({ args_json, context_json, answers_json, ...rest }) => ({
      ...rest,
      time: iso(rest.created_at),
      args: parse(args_json),
      context: parse(context_json),
      answers: parse(answers_json),
    })),
    null,
    2,
  )
}
