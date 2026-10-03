import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const tokenPath = (home: string) => join(home, "token")

export function readToken(home: string): string | null {
  const path = tokenPath(home)
  if (!existsSync(path)) return null
  return readFileSync(path, "utf8").trim() || null
}

export function ensureToken(home: string): string {
  mkdirSync(home, { recursive: true, mode: 0o700 })
  const existing = readToken(home)
  if (existing && existing.length >= 32) return existing
  const token = randomBytes(32).toString("hex")
  writeFileSync(tokenPath(home), token, { mode: 0o600 })
  return token
}

// The token travels in the #fragment, which browsers never send to the server, so GET /
// can stay unauthenticated without handing the token to whoever fetches it.
export function dashboardLink(baseUrl: string, token: string | null): string {
  const base = baseUrl.replace("127.0.0.1", "localhost").replace(/\/+$/, "")
  return token ? `${base}/#token=${token}` : `${base}/`
}
