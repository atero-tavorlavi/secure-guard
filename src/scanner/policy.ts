import type { Action, CheckKind, Final, Mode, Outcome, Settled } from "../shared/types"

//  risk < threshold ............ allow
//  risk >= threshold ── monitor  log (would block)
//                    ├─ ask ..... ask (human decides)
//                    └─ auto .... block
export function decide(risk: number, mode: Mode, threshold: number): Action {
  if (risk < threshold) return "allow"
  if (mode === "monitor") return "log"
  if (mode === "ask") return "ask"
  return "block"
}

// LAYA unreachable: fail open allows; fail closed blocks, except monitor mode never blocks.
export function failAction(failOpen: boolean, mode: Mode): Action {
  if (failOpen) return "allow"
  return mode === "monitor" ? "log" : "block"
}

export function finalFor(action: Action, kind: CheckKind): Final {
  if (action === "ask") return "pending"
  if (action === "block") return finalForOutcome("block", kind)
  return "allowed"
}

export function finalForOutcome(outcome: Outcome, kind: CheckKind): Settled {
  if (outcome === "allow") return "allowed"
  return kind === "tool-output" ? "redacted" : "blocked"
}
