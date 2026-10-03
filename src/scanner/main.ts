import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ConfigStore, guardHome } from "../shared/config"
import { dashboardLink, ensureToken } from "../shared/token"
import { EventHub } from "./events"
import { Guard, type GuardDeps } from "./guard"
import { layaHealthy } from "./laya"
import { makeRoutes } from "./routes"
import { startServer, type ServerDeps } from "./server"
import { Store } from "./store"

export interface RunningScanner {
  url: string
  token: string
  guard: Guard
  store: Store
  config: ConfigStore
  stop(): void
}

export interface ScannerOptions {
  home: string
  env?: Record<string, string | undefined>
  port?: number
  assess?: GuardDeps["assess"]
  healthIntervalMs?: number
  routes?: (deps: { store: Store; config: ConfigStore }) => ServerDeps["routes"]
}

export async function startScanner(opts: ScannerOptions): Promise<RunningScanner> {
  const config = new ConfigStore(opts.home, opts.env ?? process.env)
  const store = new Store(join(opts.home, "secure-guard.db"))
  store.prune(config.get().retentionDays)
  const hub = new EventHub()
  const guard = new Guard({ config, store, hub, home: opts.home, assess: opts.assess })
  const recovered = guard.recoverStale()
  if (recovered > 0) console.log(`[secure-guard] resolved ${recovered} decision(s) left pending by the previous run`)
  const token = ensureToken(opts.home)
  const dashboardHtml = readFileSync(join(import.meta.dir, "../dashboard/index.html"), "utf8")

  const server = startServer(
    { guard, store, config, hub, token, dashboardHtml, routes: (opts.routes ?? makeRoutes)({ store, config }) },
    opts.port ?? config.get().port,
  )

  const interval = opts.healthIntervalMs ?? 10_000
  const poll = interval > 0 ? setInterval(async () => guard.setLaya(await layaHealthy(config.get().laya.url)), interval) : null
  if (interval > 0) guard.setLaya(await layaHealthy(config.get().laya.url))

  return {
    url: `http://127.0.0.1:${server.port}`,
    token,
    guard,
    store,
    config,
    stop() {
      if (poll) clearInterval(poll)
      guard.stop()
      server.stop(true)
      store.close()
    },
  }
}

if (import.meta.main) {
  const s = await startScanner({ home: guardHome() })
  console.log(`Secure Guard scanner on ${s.url} (dashboard: ${dashboardLink(s.url, s.token)})`)
  const stop = () => {
    s.stop()
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}
