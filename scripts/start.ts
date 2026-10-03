import { spawn, type ChildProcess } from "node:child_process"
import { guardHome, loadConfig } from "../src/shared/config"
import { assess, layaHealthy } from "../src/scanner/laya"
import { startScanner } from "../src/scanner/main"
import { dashboardLink } from "../src/shared/token"

const home = guardHome()
const { config } = loadConfig(home)
let laya: ChildProcess | null = null

if (!(await layaHealthy(config.laya.url))) {
  const u = new URL(config.laya.url)
  console.log(`Starting LAYA (${config.laya.model}) on ${config.laya.url}. The first run downloads the model; this can take a few minutes.`)
  laya = spawn(process.env["LAYA_SERVE_BIN"] ?? "laya-serve", [], {
    stdio: "inherit",
    env: { ...process.env, LAYA_HOST: u.hostname, LAYA_PORT: u.port || "8000", LAYA_MODELS: config.laya.model },
  })
  laya.on("error", (err) => {
    console.error(`Could not start laya-serve (${err.message}). Install it with:  pip install "laya[serve]"  (Python 3.10 to 3.13)`)
    process.exit(1)
  })
  const deadline = Date.now() + 10 * 60_000
  while (!(await layaHealthy(config.laya.url))) {
    if (Date.now() > deadline) {
      console.error("LAYA did not become healthy within 10 minutes.")
      laya.kill()
      process.exit(1)
    }
    await Bun.sleep(1000)
  }
}

process.stdout.write("Warming up LAYA… ")
try {
  const a = await assess({ kind: "user-prompt", sessionID: "warmup", userPrompt: "hello" }, { ...config.laya, timeoutMs: 180_000 })
  console.log(`ok (${a.ms} ms)`)
} catch (err) {
  console.log(`failed: ${(err as Error).message}. The scanner will apply the fail policy until LAYA answers.`)
}

const scanner = await startScanner({ home })
console.log(`\n🛡️  Secure Guard is running\n   dashboard  ${dashboardLink(scanner.url, scanner.token)}\n   mode       ${config.mode} (threshold ${config.threshold})\n   data       ${home}\n`)

const stop = () => {
  scanner.stop()
  laya?.kill()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
