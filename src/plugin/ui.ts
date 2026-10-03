import { spawn } from "node:child_process"
import type { ScanResponse } from "../shared/types"

export interface Toast {
  title: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  duration?: number
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

export function argsPreview(tool: string, args: any): string {
  const pick = tool === "bash" ? args?.command : ["edit", "write", "patch", "multiedit", "read"].includes(tool) ? args?.filePath : tool === "webfetch" ? args?.url : undefined
  return clip(typeof pick === "string" ? pick : JSON.stringify(args) ?? "", 60)
}

export const blockToast = (r: ScanResponse, what: string): Toast => ({ title: "🛡️ Secure Guard blocked", message: `${what} · ${r.reason}`, variant: "error", duration: 8000 })

export const askToast = (r: ScanResponse, what: string, dashboard: string, native: boolean): Toast => ({
  title: "🛡️ Secure Guard needs approval",
  message: native
    ? `${what} · ${r.reason}. Approve in the prompt or at ${dashboard}`
    : `${what} · ${r.reason}. Approve at ${dashboard} or /guard-allow ${r.id}`,
  variant: "warning",
  duration: 15000,
})

export const redactToast = (r: ScanResponse, tool: string): Toast => ({ title: "🛡️ Secure Guard redacted output", message: `${tool} output · ${r.reason}`, variant: "warning", duration: 8000 })

export const allowToast = (r: ScanResponse, what: string): Toast => ({ title: "🛡️ allowed", message: `${what} · risk ${r.risk?.toFixed(2) ?? "n/a"}`, variant: "info", duration: 2500 })

export const downToast = (detail: string, failOpen: boolean): Toast => ({
  title: "🛡️ Secure Guard scanner unreachable",
  message: `${detail}. Start it with 'bun run start'. Until then checks are ${failOpen ? "allowed (fail open)" : "blocking (fail closed)"}.`,
  variant: "error",
  duration: 12000,
})

export class Toaster {
  constructor(private client: { tui: { showToast(opts: { body: Toast }): Promise<unknown> } }) {}

  async show(t: Toast): Promise<void> {
    try {
      await this.client.tui.showToast({ body: { ...t, duration: t.duration ?? 6000 } })
    } catch (err) {
      console.error("[secure-guard] could not show toast:", err)
    }
  }
}

const defaultOpener = (): string[] =>
  process.platform === "darwin" ? ["open"] : process.platform === "win32" ? ["cmd", "/c", "start", ""] : ["xdg-open"]

// Resolves false when the opener cannot be started (e.g. no xdg-open). Without an 'error'
// listener a failed spawn is an uncaught error that can take down the OpenCode host.
export function openBrowser(url: string, opener: string[] = defaultOpener()): Promise<boolean> {
  const [cmd, ...args] = opener
  return new Promise((resolve) => {
    const child = spawn(cmd!, [...args, url], { detached: true, stdio: "ignore" })
    child.on("error", (err) => {
      console.error("[secure-guard] could not open the browser:", err.message)
      resolve(false)
    })
    child.on("spawn", () => resolve(true))
    child.unref()
  })
}
