import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ConfigError, ConfigStore, DEFAULTS, envOverrides, loadConfig, mergeConfig } from "../../src/shared/config"

const tempHome = () => mkdtempSync(join(tmpdir(), "sg-config-"))

describe("mergeConfig", () => {
  test("applies a partial patch and keeps the rest", () => {
    const next = mergeConfig(DEFAULTS, { mode: "auto", laya: { maxLen: 2048 } })
    expect(next.mode).toBe("auto")
    expect(next.laya.maxLen).toBe(2048)
    expect(next.laya.url).toBe(DEFAULTS.laya.url)
    expect(next.threshold).toBe(DEFAULTS.threshold)
  })

  test("does not mutate the base", () => {
    mergeConfig(DEFAULTS, { mode: "auto", laya: { model: "english" } })
    expect(DEFAULTS.mode).toBe("ask")
    expect(DEFAULTS.laya.model).toBe("typed-decisions")
  })

  test.each([
    [{ mode: "yolo" }, "mode"],
    [{ threshold: 0 }, "threshold"],
    [{ threshold: 1.5 }, "threshold"],
    [{ askTimeoutSec: 2 }, "askTimeoutSec"],
    [{ askTimeoutDefault: "maybe" }, "askTimeoutDefault"],
    [{ failOpen: "yes" }, "failOpen"],
    [{ nativePrompt: "yes" }, "nativePrompt"],
    [{ checkPrompts: "yes" }, "checkPrompts must be true or false"],
    [{ checkToolOutputs: 1 }, "checkToolOutputs must be true or false"],
    [{ contextTurns: -1 }, "contextTurns must be an integer from 0 to 5"],
    [{ contextTurns: 6 }, "contextTurns must be an integer from 0 to 5"],
    [{ contextTurns: 2.5 }, "contextTurns must be an integer from 0 to 5"],
    [{ port: 70000 }, "port"],
    [{ retentionDays: 0 }, "retentionDays"],
    [{ laya: { url: "ftp://x" } }, "laya.url"],
    [{ laya: { maxLen: 64 } }, "laya.maxLen"],
    [{ laya: { timeoutMs: 10 } }, "laya.timeoutMs"],
    [{ laya: { timeoutMs: 20_001 } }, "laya.timeoutMs must be an integer from 100 to 20000"],
    [{ bogus: 1 }, "unknown setting: bogus"],
    [{ laya: { bogus: 1 } }, "unknown setting: laya.bogus"],
    [{ constructor: 1 }, "unknown setting: constructor"],
    [{ toString: 1 }, "unknown setting: toString"],
    [{ laya: { hasOwnProperty: 1 } }, "unknown setting: laya.hasOwnProperty"],
    [[], "JSON object"],
  ])("rejects %j", (patch, message) => {
    expect(() => mergeConfig(DEFAULTS, patch)).toThrow(ConfigError)
    expect(() => mergeConfig(DEFAULTS, patch)).toThrow(message)
  })

  test("defaults: threshold 0.29, native prompt on, only tool calls checked, 0 context turns", () => {
    expect(DEFAULTS.threshold).toBe(0.29)
    expect(DEFAULTS.nativePrompt).toBe(true)
    expect(DEFAULTS.checkPrompts).toBe(false)
    expect(DEFAULTS.checkToolOutputs).toBe(false)
    expect(DEFAULTS.contextTurns).toBe(0)
  })

  test("accepts the new check settings", () => {
    expect(mergeConfig(DEFAULTS, { checkPrompts: true, checkToolOutputs: true, contextTurns: 0 })).toMatchObject({ checkPrompts: true, checkToolOutputs: true, contextTurns: 0 })
    expect(mergeConfig(DEFAULTS, { contextTurns: 5 }).contextTurns).toBe(5)
  })
})

describe("envOverrides", () => {
  test("maps env vars to settings", () => {
    expect(envOverrides({ SECURE_GUARD_MODE: "auto", SECURE_GUARD_THRESHOLD: "0.9", PROMPT_GUARD_FAIL_OPEN: "1", LAYA_MODEL: "english" }))
      .toEqual({ mode: "auto", threshold: 0.9, failOpen: true, laya: { model: "english" } })
  })

  test("PROMPT_GUARD_FAIL_OPEN other than 1 means closed", () => {
    expect(envOverrides({ PROMPT_GUARD_FAIL_OPEN: "0" })).toEqual({ failOpen: false })
  })
})

describe("loadConfig / ConfigStore", () => {
  test("missing file gives defaults and ConfigStore writes the file", () => {
    const home = tempHome()
    const store = new ConfigStore(home, {})
    expect(store.get()).toEqual(DEFAULTS)
    expect(JSON.parse(readFileSync(join(home, "config.json"), "utf8"))).toEqual(DEFAULTS)
  })

  test("env overrides the file but update persists to the file", () => {
    const home = tempHome()
    writeFileSync(join(home, "config.json"), JSON.stringify({ mode: "monitor" }))
    const store = new ConfigStore(home, { SECURE_GUARD_MODE: "auto" })
    expect(store.get().mode).toBe("auto")
    store.update({ threshold: 0.7 })
    expect(store.get().threshold).toBe(0.7)
    const onDisk = JSON.parse(readFileSync(join(home, "config.json"), "utf8"))
    expect(onDisk.mode).toBe("monitor")
    expect(onDisk.threshold).toBe(0.7)
  })

  test("invalid JSON in the file is a ConfigError naming the file", () => {
    const home = tempHome()
    writeFileSync(join(home, "config.json"), "{ nope")
    expect(() => loadConfig(home, {})).toThrow(/config\.json is not valid JSON/)
  })

  test("update replaces the file atomically (temp file + rename), so a live reader never sees a torn write", () => {
    const home = tempHome()
    const store = new ConfigStore(home, {})
    const before = statSync(join(home, "config.json")).ino
    store.update({ threshold: 0.6 })
    expect(statSync(join(home, "config.json")).ino).not.toBe(before)
    expect(existsSync(join(home, "config.json.tmp"))).toBe(false)
    expect(JSON.parse(readFileSync(join(home, "config.json"), "utf8")).threshold).toBe(0.6)
  })

  test("a rejected update changes nothing", () => {
    const store = new ConfigStore(tempHome(), {})
    expect(() => store.update({ mode: "bad" })).toThrow(ConfigError)
    expect(store.get().mode).toBe("ask")
  })
})
