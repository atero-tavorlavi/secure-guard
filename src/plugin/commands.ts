import type { Mode, Outcome } from "../shared/types"

export const COMMAND_DEFS: Record<string, { template: string; description: string }> = {
  guard: { template: "secure-guard status", description: "Secure Guard: status, mode and counts" },
  "guard-mode": { template: "secure-guard mode $ARGUMENTS", description: "Secure Guard: set mode (monitor | ask | auto)" },
  "guard-dashboard": { template: "secure-guard dashboard", description: "Secure Guard: open the dashboard" },
  "guard-allow": { template: "secure-guard allow $ARGUMENTS", description: "Secure Guard: allow a pending item by id" },
  "guard-deny": { template: "secure-guard deny $ARGUMENTS", description: "Secure Guard: block a pending item by id" },
  "guard-off": { template: "secure-guard off", description: "Secure Guard: pause checks for this session" },
  "guard-on": { template: "secure-guard on", description: "Secure Guard: resume checks for this session" },
}

export type ParsedCommand =
  | { name: "status" }
  | { name: "mode"; mode: Mode }
  | { name: "dashboard" }
  | { name: "decide"; id: string; outcome: Outcome }
  | { name: "pause" }
  | { name: "resume" }
  | { name: "error"; message: string }

export function parseCommand(command: string, args: string): ParsedCommand | null {
  const arg = args.trim().toLowerCase()
  switch (command) {
    case "guard":
      return { name: "status" }
    case "guard-mode":
      return arg === "monitor" || arg === "ask" || arg === "auto" ? { name: "mode", mode: arg } : { name: "error", message: "usage: /guard-mode monitor|ask|auto" }
    case "guard-dashboard":
      return { name: "dashboard" }
    case "guard-allow":
    case "guard-deny":
      return /^[0-9a-f]{10}$/.test(arg)
        ? { name: "decide", id: arg, outcome: command === "guard-allow" ? "allow" : "block" }
        : { name: "error", message: `usage: /${command} <id>` }
    case "guard-off":
      return { name: "pause" }
    case "guard-on":
      return { name: "resume" }
    default:
      return null
  }
}
