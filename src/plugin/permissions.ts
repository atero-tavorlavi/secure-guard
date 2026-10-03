export type PermKey = "edit" | "bash" | "webfetch"

const PERM_KEYS: PermKey[] = ["edit", "bash", "webfetch"]

export const TOOL_PERMISSION: Record<string, PermKey> = {
  edit: "edit",
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  bash: "bash",
  webfetch: "webfetch",
}

export interface NativePlan {
  native: Set<PermKey> // flagged calls on these tools get OpenCode's own prompt
  autoReply: Set<PermKey> // unflagged calls on these tools are answered "once" by the plugin
}

type Scope = Record<string, unknown>
interface OpencodeConfig {
  permission?: Scope
  agent?: Record<string, { permission?: Scope } | undefined>
}

// OpenCode merges agent-level permissions after the global ones, so both must be upgraded
// or an agent's own "allow" would skip the prompt for a flagged call.
//
//   value in any scope      native prompt          plugin auto-answers unflagged calls
//   unset / "allow"         yes (set to "ask")     yes
//   "ask"                   yes                    no  (the user chose to be asked)
//   "deny"                  yes (tool never runs)  unaffected
//   pattern map             no (key opted out)     no
export function planNativePrompt(config: OpencodeConfig): NativePlan {
  const global = (config.permission ??= {})
  const agents = Object.values(config.agent ?? {}).flatMap((a) => (a?.permission ? [a.permission] : []))
  const plan: NativePlan = { native: new Set(), autoReply: new Set() }
  for (const key of PERM_KEYS) {
    const values = [global, ...agents].map((scope) => scope[key])
    if (values.some((v) => v !== undefined && typeof v !== "string")) continue
    if (global[key] === undefined || global[key] === "allow") global[key] = "ask"
    for (const scope of agents) if (scope[key] === "allow") scope[key] = "ask"
    plan.native.add(key)
    if (!values.includes("ask")) plan.autoReply.add(key)
  }
  return plan
}
