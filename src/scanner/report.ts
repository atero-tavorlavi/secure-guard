import { escapeHtml } from "../shared/html"
import type { DecisionRow } from "../shared/types"
import { barList, columnChart } from "./charts"
import type { Stats } from "./store"

export interface ReportInput {
  stats: Stats
  rows: DecisionRow[]
  rangeLabel: string
  generatedAt: number
  bucketMs: number
}

const fmtBucket = (ms: number, bucketMs: number) => {
  const d = new Date(ms)
  return bucketMs < 86_400_000 ? `${String(d.getHours()).padStart(2, "0")}:00` : `${d.getMonth() + 1}/${d.getDate()}`
}

export const chartsFor = (stats: Stats, bucketMs: number) => ({
  series: columnChart(stats.series.map((b) => ({ label: fmtBucket(b.start, bucketMs), value: b.count })), "Blocks over time"),
  byAttackType: barList(stats.byAttackType.map((b) => ({ label: b.label, value: b.count })), "Blocks by attack type"),
  byTool: barList(stats.byTool.map((b) => ({ label: b.label, value: b.count })), "Top blocked tools"),
})

const CSS = `
:root{--bg:#fbfbfa;--fg:#1d1d1f;--muted:#6b6b70;--card:#fff;--line:#e4e4e7;--danger:#c0392b;--bar:#d65a4a}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececef;--muted:#9a9aa2;--card:#1d1d21;--line:#2c2c31;--danger:#ff6b5b;--bar:#e0675a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}.muted{color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:20px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}.kpi b{display:block;font-size:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.bar{fill:var(--bar)}.axis{stroke:var(--line)}.chart-label,.chart-value{fill:var(--muted);font-size:11px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px;border-bottom:1px solid var(--line);vertical-align:top}
code{font:12px ui-monospace,Menlo,monospace;word-break:break-all}`

export function renderReport({ stats, rows, rangeLabel, generatedAt, bucketMs }: ReportInput): string {
  const charts = chartsFor(stats, bucketMs)
  const kpi = (value: string, label: string) => `<div class="kpi"><b>${escapeHtml(value)}</b><span class="muted">${escapeHtml(label)}</span></div>`
  const samples = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16))}</td>` +
        `<td>${escapeHtml(r.kind)}</td><td>${escapeHtml(r.tool ?? "")}</td>` +
        `<td>${escapeHtml(r.attack_type ?? "")}</td><td>${r.risk === null ? "" : r.risk.toFixed(2)}</td>` +
        `<td>${escapeHtml(r.final)}${r.false_positive ? " (false positive)" : ""}</td>` +
        `<td><code>${escapeHtml((r.args_json ?? r.context_json).slice(0, 300))}</code></td></tr>`,
    )
    .join("")
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Secure Guard report</title><style>${CSS}</style></head>
<body><main>
<h1>Secure Guard report</h1>
<p class="muted">${escapeHtml(rangeLabel)} · generated ${escapeHtml(new Date(generatedAt).toISOString().replace("T", " ").slice(0, 16))} UTC · guard model: LAYA</p>
<div class="kpis">
${kpi(String(stats.checked), "checked")}${kpi(String(stats.blocked), "blocked")}${kpi((stats.blockRate * 100).toFixed(1) + "%", "block rate")}${kpi(String(stats.wouldBlock), "would block (monitor)")}${kpi(String(stats.falsePositives), "false positives")}
</div>
<div class="card"><h2>Blocks over time</h2>${charts.series}</div>
<div class="grid2"><div class="card"><h2>By attack type</h2>${charts.byAttackType}</div><div class="card"><h2>Top blocked tools</h2>${charts.byTool}</div></div>
<div class="card"><h2>Blocked samples (latest ${rows.length})</h2>
<table><thead><tr><th>time (UTC)</th><th>check</th><th>tool</th><th>type</th><th>risk</th><th>result</th><th>content</th></tr></thead><tbody>${samples}</tbody></table></div>
</main></body></html>`
}
