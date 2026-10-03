import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { guardHome } from "../src/shared/config"
import { datasetLine } from "../src/scanner/dataset"
import { Store } from "../src/scanner/store"

const home = guardHome()
const out = process.argv[2] ?? join(home, "dataset.jsonl")
const store = new Store(join(home, "secure-guard.db"))
const lines = store.list({ limit: 100_000 }).map(datasetLine).filter((l): l is string => l !== null)
writeFileSync(out, lines.join("\n") + (lines.length ? "\n" : ""))
store.close()
console.log(`Wrote ${lines.length} examples to ${out}`)
