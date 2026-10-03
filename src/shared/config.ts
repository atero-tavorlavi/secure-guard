import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Mode, Outcome } from "./types"

export interface GuardConfig {
  mode: Mode
  threshold: number
  askTimeoutSec: number
  askTimeoutDefault: Outcome
  failOpen: boolean
  verbose: boolean
  nativePrompt: boolean
  checkPrompts: boolean
  checkToolOutputs: boolean
  contextTurns: number
  port: number
  retentionDays: number
  laya: { url: string; model: string; maxLen: number; timeoutMs: number }
}

export const DEFAULTS: GuardConfig = Object.freeze({
  mode: "ask",
  threshold: 0.45,
  askTimeoutSec: 120,
  askTimeoutDefault: "block",
  failOpen: false,
  verbose: false,
  nativePrompt: true,
  checkPrompts: false,
  checkToolOutputs: false,
  contextTurns: 3,
  port: 9000,
  retentionDays: 30,
  laya: Object.freeze({ url: "http://127.0.0.1:8000", model: "typed-decisions", maxLen: 1024, timeoutMs: 2000 }),
}) as GuardConfig

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>

export const guardHome = (env: Env = process.env) => env["SECURE_GUARD_HOME"] ?? join(homedir(), ".secure-guard")
export const configPath = (home: string) => join(home, "config.json")

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const check = (ok: boolean, message: string) => {
  if (!ok) throw new ConfigError(message)
}

export function mergeConfig(base: GuardConfig, patch: unknown): GuardConfig {
  check(isObject(patch), "config must be a JSON object")
  const p = patch as Record<string, unknown>
  for (const key of Object.keys(p)) check(Object.hasOwn(DEFAULTS, key), `unknown setting: ${key}`)
  const layaPatch = p["laya"] ?? {}
  check(isObject(layaPatch), "laya must be a JSON object")
  for (const key of Object.keys(layaPatch as object)) check(Object.hasOwn(DEFAULTS.laya, key), `unknown setting: laya.${key}`)

  const next = { ...base, ...p, laya: { ...base.laya, ...(layaPatch as object) } } as GuardConfig
  check(["monitor", "ask", "auto"].includes(next.mode), "mode must be monitor, ask or auto")
  check(typeof next.threshold === "number" && next.threshold > 0 && next.threshold <= 1, "threshold must be a number above 0 and at most 1")
  check(isInt(next.askTimeoutSec, 5, 3600), "askTimeoutSec must be an integer from 5 to 3600")
  check(next.askTimeoutDefault === "allow" || next.askTimeoutDefault === "block", "askTimeoutDefault must be allow or block")
  check(typeof next.failOpen === "boolean", "failOpen must be true or false")
  check(typeof next.verbose === "boolean", "verbose must be true or false")
  check(typeof next.nativePrompt === "boolean", "nativePrompt must be true or false")
  check(typeof next.checkPrompts === "boolean", "checkPrompts must be true or false")
  check(typeof next.checkToolOutputs === "boolean", "checkToolOutputs must be true or false")
  check(isInt(next.contextTurns, 0, 5), "contextTurns must be an integer from 0 to 5")
  check(isInt(next.port, 1, 65535), "port must be an integer from 1 to 65535")
  check(isInt(next.retentionDays, 1, 3650), "retentionDays must be an integer from 1 to 3650")
  check(typeof next.laya.url === "string" && /^https?:\/\/[^/]+/.test(next.laya.url), "laya.url must be an http(s) URL")
  check(typeof next.laya.model === "string" && next.laya.model.trim() !== "", "laya.model must be a non-empty string")
  check(isInt(next.laya.maxLen, 128, 8192), "laya.maxLen must be an integer from 128 to 8192")
  // Per window. All windows of one check share a deadline of timeoutMs × windows, capped at
  // 50 s: under the plugin's 60 s /scan timeout, so a slow LAYA is never mistaken for an
  // unreachable scanner.
  check(isInt(next.laya.timeoutMs, 100, 20000), "laya.timeoutMs must be an integer from 100 to 20000")
  return next
}

export function envOverrides(env: Env): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  const laya: Record<string, unknown> = {}
  if (env["SECURE_GUARD_MODE"]) o["mode"] = env["SECURE_GUARD_MODE"]
  if (env["SECURE_GUARD_THRESHOLD"]) o["threshold"] = Number(env["SECURE_GUARD_THRESHOLD"])
  if (env["SECURE_GUARD_ASK_TIMEOUT"]) o["askTimeoutSec"] = Number(env["SECURE_GUARD_ASK_TIMEOUT"])
  if (env["SECURE_GUARD_PORT"]) o["port"] = Number(env["SECURE_GUARD_PORT"])
  if (env["PROMPT_GUARD_FAIL_OPEN"] !== undefined) o["failOpen"] = env["PROMPT_GUARD_FAIL_OPEN"] === "1"
  if (env["LAYA_URL"]) laya["url"] = env["LAYA_URL"]
  if (env["LAYA_MODEL"]) laya["model"] = env["LAYA_MODEL"]
  if (Object.keys(laya).length > 0) o["laya"] = laya
  return o
}

export function loadConfig(home: string, env: Env = process.env): { file: GuardConfig; config: GuardConfig } {
  const path = configPath(home)
  let file = DEFAULTS
  if (existsSync(path)) {
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (err) {
      throw new ConfigError(`${path} is not valid JSON: ${(err as Error).message}`)
    }
    file = mergeConfig(DEFAULTS, raw)
  }
  return { file, config: mergeConfig(file, envOverrides(env)) }
}

export class ConfigStore {
  private file: GuardConfig
  private current: GuardConfig

  constructor(private home: string, env: Env = process.env) {
    const loaded = loadConfig(home, env)
    this.file = loaded.file
    this.current = loaded.config
    if (!existsSync(configPath(home))) this.write()
  }

  get(): GuardConfig {
    return this.current
  }

  update(patch: unknown): GuardConfig {
    const current = mergeConfig(this.current, patch)
    const file = mergeConfig(this.file, patch)
    this.current = current
    this.file = file
    this.write()
    return current
  }

  private write() {
    mkdirSync(this.home, { recursive: true, mode: 0o700 })
    // The plugin re-reads this file live: write a temp file and rename it into place.
    const path = configPath(this.home)
    writeFileSync(`${path}.tmp`, JSON.stringify(this.file, null, 2) + "\n")
    renameSync(`${path}.tmp`, path)
  }
}
