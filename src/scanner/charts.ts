import { escapeHtml } from "../shared/html"

export interface Bar {
  label: string
  value: number
}

// Colors come from the host page's CSS: .bar, .axis, .chart-label, .chart-value.
export function columnChart(bars: Bar[], title: string): string {
  const w = 640, h = 160, pad = 24, gap = 2
  const max = Math.max(1, ...bars.map((b) => b.value))
  const bw = bars.length ? (w - pad * 2) / bars.length : 0
  const rects = bars
    .map((b, i) => {
      const bh = Math.round((b.value / max) * (h - pad * 2))
      const x = (pad + i * bw + gap / 2).toFixed(1)
      return `<rect class="bar" x="${x}" y="${h - pad - bh}" width="${Math.max(1, bw - gap).toFixed(1)}" height="${bh}" rx="2"><title>${escapeHtml(b.label)}: ${b.value}</title></rect>`
    })
    .join("")
  return (
    `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">` +
    `<title>${escapeHtml(title)}</title>` +
    `<text class="chart-label" x="${pad}" y="14">max ${max}</text>` +
    rects +
    `<line class="axis" x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}"/>` +
    `<text class="chart-label" x="${pad}" y="${h - 6}">${escapeHtml(bars[0]?.label ?? "")}</text>` +
    `<text class="chart-label" x="${w - pad}" y="${h - 6}" text-anchor="end">${escapeHtml(bars.at(-1)?.label ?? "")}</text>` +
    `</svg>`
  )
}

export function barList(bars: Bar[], title: string): string {
  const w = 320, row = 26, labelW = 130
  if (bars.length === 0) {
    return `<svg viewBox="0 0 ${w} ${row}" width="100%" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg"><title>${escapeHtml(title)}</title><text class="chart-label" x="0" y="17">No blocks in this range</text></svg>`
  }
  const max = Math.max(1, ...bars.map((b) => b.value))
  const rows = bars
    .map((b, i) => {
      const y = i * row
      const bw = Math.max(2, Math.round((b.value / max) * (w - labelW - 40)))
      return (
        `<text class="chart-label" x="0" y="${y + 17}">${escapeHtml(b.label.replace(/_/g, " "))}</text>` +
        `<rect class="bar" x="${labelW}" y="${y + 5}" width="${bw}" height="16" rx="2"><title>${escapeHtml(b.label)}: ${b.value}</title></rect>` +
        `<text class="chart-value" x="${labelW + bw + 6}" y="${y + 17}">${b.value}</text>`
      )
    })
    .join("")
  return `<svg viewBox="0 0 ${w} ${bars.length * row}" width="100%" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg"><title>${escapeHtml(title)}</title>${rows}</svg>`
}
