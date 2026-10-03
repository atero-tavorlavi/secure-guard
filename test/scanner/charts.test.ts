import { expect, test } from "bun:test"
import { barList, columnChart } from "../../src/scanner/charts"

test("columnChart draws one rect per bar, scaled to the max, and escapes labels", () => {
  const svg = columnChart([{ label: "<b>", value: 2 }, { label: "b", value: 4 }, { label: "c", value: 0 }], "Blocks & more")
  expect(svg.startsWith("<svg")).toBe(true)
  expect(svg.match(/<rect class="bar"/g)!.length).toBe(3)
  expect(svg).toContain("&lt;b&gt;: 2")
  expect(svg).toContain('aria-label="Blocks &amp; more"')
  expect(svg).not.toContain("<b>")
})

test("all-zero data still renders", () => {
  expect(columnChart([{ label: "a", value: 0 }], "t")).toContain('height="0"')
})

test("barList shows labels and values", () => {
  const svg = barList([{ label: "bash", value: 21 }, { label: "edit", value: 5 }], "Top tools")
  expect(svg).toContain(">bash<")
  expect(svg).toContain(">21<")
})

test("empty barList says so", () => {
  expect(barList([], "Top tools")).toContain("No blocks in this range")
})
