import type { CheckRequest } from "../shared/types"

const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out)
  else if (value !== null && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, out)
  return out
}

// Best effort: stops the guarded agent from calling the guard's API or touching its files.
export function touchesGuard(req: CheckRequest, guard: { port: number; home: string }): string | null {
  if (req.kind !== "tool-call") return null
  const needles = [
    `localhost:${guard.port}`,
    `127.0.0.1:${guard.port}`,
    `0.0.0.0:${guard.port}`,
    `[::1]:${guard.port}`,
    guard.home,
    ".secure-guard", // the data directory, any spelling of its parent
    "secure-guard.db",
  ]
  // Any host spelling (127.1, 0x7f000001, aliases) followed by the guard's port, and the
  // installed OpenCode plugin file. A checkout named secure-guard is not the guard.
  const anyHostOnPort = new RegExp(`:${guard.port}(?!\\d)`)
  const pluginFile = /opencode[/\\]plugins?[/\\]secure-guard/
  const hit = collectStrings(req.args).some((s) => needles.some((n) => s.includes(n)) || anyHostOnPort.test(s) || pluginFile.test(s))
  return hit ? "touches Secure Guard's own API or files" : null
}
