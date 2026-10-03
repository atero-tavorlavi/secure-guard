import { Database } from "bun:sqlite"
import type { AttackType, DecidedBy, DecisionRow, Final, Settled } from "../shared/types"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  tool TEXT,
  args_json TEXT,
  context_json TEXT NOT NULL,
  risk REAL,
  attack_type TEXT,
  severity TEXT,
  answers_json TEXT,
  reason TEXT NOT NULL,
  mode TEXT NOT NULL,
  action TEXT NOT NULL,
  final TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at INTEGER,
  expires_at INTEGER,
  truncated INTEGER NOT NULL DEFAULT 0,
  false_positive INTEGER NOT NULL DEFAULT 0,
  laya_ms INTEGER
);
CREATE INDEX IF NOT EXISTS decisions_created ON decisions(created_at);
CREATE INDEX IF NOT EXISTS decisions_final ON decisions(final);
`

const COLUMNS = [
  "id", "created_at", "session_id", "kind", "tool", "args_json", "context_json", "risk", "attack_type", "severity",
  "answers_json", "reason", "mode", "action", "final", "decided_by", "decided_at", "expires_at", "truncated",
  "false_positive", "laya_ms",
] as const

// "Flagged" = LAYA or a rule said block: blocked, redacted, or would-block in monitor mode.
const FLAGGED_SQL = "(final IN ('blocked','redacted') OR action = 'log')"
const BLOCKED_SQL = "final IN ('blocked','redacted')"

export type NewDecision = Omit<DecisionRow, "decided_at" | "false_positive">

export interface LogFilter {
  final?: Final
  flagged?: boolean
  attackType?: AttackType
  tool?: string
  session?: string
  q?: string
  from?: number
  to?: number
  limit?: number
}

export interface Stats {
  checked: number
  blocked: number
  wouldBlock: number
  pending: number
  falsePositives: number
  blockRate: number
  series: { start: number; count: number }[]
  byAttackType: { label: string; count: number }[]
  byTool: { label: string; count: number }[]
}

export const isFlagged = (row: DecisionRow) => row.final === "blocked" || row.final === "redacted" || row.action === "log"

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c)

export class Store {
  private db: Database

  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true })
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec(SCHEMA)
  }

  insert(d: NewDecision): DecisionRow {
    const row: DecisionRow = { ...d, decided_at: d.final === "pending" ? null : d.created_at, false_positive: 0 }
    const sql = `INSERT INTO decisions (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map((c) => "$" + c).join(", ")})`
    this.db.query(sql).run(row as any)
    return row
  }

  get(id: string): DecisionRow | null {
    return (this.db.query("SELECT * FROM decisions WHERE id = $id").get({ id }) as DecisionRow | null) ?? null
  }

  finalize(id: string, final: Settled, by: DecidedBy, at = Date.now()): DecisionRow | null {
    const result = this.db
      .query("UPDATE decisions SET final = $final, decided_by = $by, decided_at = $at WHERE id = $id AND final = 'pending'")
      .run({ id, final, by, at })
    return result.changes === 1 ? this.get(id) : null
  }

  list(f: LogFilter = {}): DecisionRow[] {
    const where: string[] = []
    const params: Record<string, string | number> = {}
    if (f.final) { where.push("final = $final"); params["final"] = f.final }
    if (f.flagged) where.push(FLAGGED_SQL)
    if (f.attackType) { where.push("attack_type = $attackType"); params["attackType"] = f.attackType }
    if (f.tool) { where.push("tool = $tool"); params["tool"] = f.tool }
    if (f.session) { where.push("session_id = $session"); params["session"] = f.session }
    if (f.q) {
      where.push("(args_json LIKE $q ESCAPE '\\' OR context_json LIKE $q ESCAPE '\\' OR reason LIKE $q ESCAPE '\\')")
      params["q"] = `%${escapeLike(f.q)}%`
    }
    if (f.from !== undefined) { where.push("created_at >= $from"); params["from"] = f.from }
    if (f.to !== undefined) { where.push("created_at < $to"); params["to"] = f.to }
    const limit = Math.min(Math.max(Math.trunc(f.limit ?? 200), 1), 100_000)
    const sql = `SELECT * FROM decisions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC, rowid DESC LIMIT ${limit}`
    return this.db.query(sql).all(params) as DecisionRow[]
  }

  pendingIds(): string[] {
    return (this.db.query("SELECT id FROM decisions WHERE final = 'pending'").all() as { id: string }[]).map((r) => r.id)
  }

  setFalsePositive(id: string, value: boolean): DecisionRow | null {
    const result = this.db
      .query(`UPDATE decisions SET false_positive = $v WHERE id = $id AND ${FLAGGED_SQL}`)
      .run({ id, v: value ? 1 : 0 })
    return result.changes === 1 ? this.get(id) : null
  }

  counts(session?: string): { checked: number; blocked: number; pending: number } {
    const scope = session === undefined ? "1 = 1" : "session_id = $session"
    const params: Record<string, string> = {}
    if (session !== undefined) {
      params.session = session
    }
    return this.db
      .query(
        `SELECT COUNT(*) AS checked,
                COALESCE(SUM(CASE WHEN ${BLOCKED_SQL} THEN 1 ELSE 0 END), 0) AS blocked,
                COALESCE(SUM(CASE WHEN final = 'pending' THEN 1 ELSE 0 END), 0) AS pending
         FROM decisions WHERE ${scope}`,
      )
      .get(params) as { checked: number; blocked: number; pending: number }
  }

  stats(from: number, to: number, bucketMs: number): Stats {
    const range = "created_at >= $from AND created_at < $to"
    const totals = this.db
      .query(
        `SELECT COUNT(*) AS checked,
                COALESCE(SUM(CASE WHEN ${BLOCKED_SQL} THEN 1 ELSE 0 END), 0) AS blocked,
                COALESCE(SUM(CASE WHEN action = 'log' THEN 1 ELSE 0 END), 0) AS wouldBlock,
                COALESCE(SUM(false_positive), 0) AS falsePositives
         FROM decisions WHERE ${range}`,
      )
      .get({ from, to }) as { checked: number; blocked: number; wouldBlock: number; falsePositives: number }
    const pending = (this.db.query("SELECT COUNT(*) AS n FROM decisions WHERE final = 'pending'").get() as { n: number }).n

    const buckets = this.db
      .query(`SELECT CAST((created_at - $from) / $bucket AS INTEGER) AS b, COUNT(*) AS count FROM decisions WHERE ${range} AND ${BLOCKED_SQL} GROUP BY b`)
      .all({ from, to, bucket: bucketMs }) as { b: number; count: number }[]
    const series = Array.from({ length: Math.ceil((to - from) / bucketMs) }, (_, i) => ({
      start: from + i * bucketMs,
      count: buckets.find((x) => x.b === i)?.count ?? 0,
    }))

    const byAttackType = this.db
      .query(`SELECT attack_type AS label, COUNT(*) AS count FROM decisions WHERE ${range} AND ${BLOCKED_SQL} AND attack_type IS NOT NULL GROUP BY attack_type ORDER BY count DESC, label LIMIT 8`)
      .all({ from, to }) as { label: string; count: number }[]
    const byTool = this.db
      .query(`SELECT COALESCE(tool, kind) AS label, COUNT(*) AS count FROM decisions WHERE ${range} AND ${BLOCKED_SQL} GROUP BY label ORDER BY count DESC, label LIMIT 8`)
      .all({ from, to }) as { label: string; count: number }[]

    return { ...totals, pending, blockRate: totals.checked ? totals.blocked / totals.checked : 0, series, byAttackType, byTool }
  }

  prune(retentionDays: number, now = Date.now()): number {
    return this.db
      .query("DELETE FROM decisions WHERE created_at < $cutoff AND final != 'pending'")
      .run({ cutoff: now - retentionDays * 86_400_000 }).changes
  }

  close() {
    this.db.close()
  }
}
