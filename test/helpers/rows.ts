import type { DecisionRow } from "../../src/shared/types"

export const row = (over: Partial<DecisionRow> = {}): DecisionRow => ({
  id: "abc", created_at: Date.UTC(2026, 9, 3, 12), session_id: "s", kind: "tool-call", tool: "bash",
  args_json: JSON.stringify({ command: "rm -rf ~" }), context_json: JSON.stringify({ userPrompt: "clean", history: [], output: null }),
  risk: 0.97, attack_type: "destructive_action", severity: "critical", answers_json: "{}", reason: "destructive action · critical · risk 0.97",
  mode: "auto", action: "block", final: "blocked", decided_by: "laya", decided_at: Date.UTC(2026, 9, 3, 12), expires_at: null,
  truncated: 0, false_positive: 0, laya_ms: 30, ...over,
})
