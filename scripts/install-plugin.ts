import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Directory confirmed in the spike (F6). Override with OPENCODE_PLUGIN_DIR.
const dir = process.env["OPENCODE_PLUGIN_DIR"] ?? join(homedir(), ".config", "opencode", "plugin")
const dist = join(import.meta.dir, "..", "dist")

const result = await Bun.build({ entrypoints: [join(import.meta.dir, "..", "src", "plugin", "index.ts")], outdir: dist, target: "bun", naming: "secure-guard.js" })
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

mkdirSync(dir, { recursive: true })
copyFileSync(join(dist, "secure-guard.js"), join(dir, "secure-guard.js"))
console.log(`Installed ${join(dir, "secure-guard.js")}`)

for (const old of [join(homedir(), ".opencode", "plugins", "prompt-guard.ts"), join(dir, "prompt-guard.ts")]) {
  if (existsSync(old)) {
    rmSync(old)
    console.log(`Removed the old prototype plugin ${old}`)
  }
}
console.log("Restart OpenCode to load Secure Guard.")
