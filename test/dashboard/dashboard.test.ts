import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const html = readFileSync(join(import.meta.dir, "../../src/dashboard/index.html"), "utf8")

test("takes the token from the #token= fragment, not from the page, and has the four tabs", () => {
  expect(html).not.toContain("__GUARD_TOKEN__")
  expect(html).not.toContain('name="guard-token"')
  expect(html).toContain("location.hash")
  expect(html).toContain("sessionStorage")
  expect(html).toMatch(/history\.replaceState/)
  expect(html).toContain("Open the dashboard from OpenCode (/guard-dashboard) or the link printed by bun run start.")
  for (const tab of ["overview", "pending", "log", "settings"]) expect(html).toContain(`data-tab="${tab}"`)
})

test("never writes decision data through innerHTML", () => {
  const uses = html.match(/\.innerHTML\s*=/g) ?? []
  // The only allowed innerHTML writes are the three server-rendered SVG charts.
  expect(uses.length).toBe(3)
  expect(html).toMatch(/innerHTML\s*=\s*data\.charts\.series/)
  expect(html).toMatch(/innerHTML\s*=\s*data\.charts\.byAttackType/)
  expect(html).toMatch(/innerHTML\s*=\s*data\.charts\.byTool/)
  expect(html).not.toMatch(/insertAdjacentHTML|outerHTML\s*=|document\.write/)
})

test("loads nothing from the network", () => {
  expect(html).not.toMatch(/<script[^>]+src=/)
  expect(html).not.toMatch(/<link[^>]+href="https?:/)
})

test("a global rule hides any [hidden] element, so badges and banners actually hide", () => {
  expect(html).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/)
})

test("the drawer body is replaced with a single built node, not raw arrays/nulls", () => {
  expect(html).toMatch(/\$\("#d-body"\)\.replaceChildren\(\s*h\(/)
})

test("settings has a port field", () => {
  expect(html).toContain('name="port"')
})

test("settings has the check toggles and the context turn count", () => {
  expect(html).toMatch(/<select id="s-checkPrompts" name="checkPrompts"><option value="false">[^<]+<\/option><option value="true">/)
  expect(html).toMatch(/<select id="s-checkToolOutputs" name="checkToolOutputs"><option value="false">[^<]+<\/option><option value="true">/)
  expect(html).toMatch(/<input id="s-contextTurns" name="contextTurns" type="number" min="0" max="5"/)
})

test("the drawer shows the reasoning and recent turns as text", () => {
  expect(html).toMatch(/ctx\.reasoning \? \[h\("strong", \{\}, "Reasoning"\), h\("pre", \{\}, ctx\.reasoning\)\]/)
  expect(html).toContain('h("strong", {}, "Recent turns")')
})

test("a decision event for the decision open in the drawer re-renders the drawer", () => {
  const handler = html.slice(html.indexOf('es.addEventListener("decision"'), html.indexOf('es.addEventListener("config"'))
  expect(handler).toMatch(/if \(row\.id === openDrawerId\) openDrawer\(row\.id\)/)
  expect(html).toMatch(/async function openDrawer\(id\) \{\s*openDrawerId = id/)
  expect(html).toMatch(/function closeDrawer\(\) \{[^}]*openDrawerId = null/)
})

test("a drawer closed or failed while loading is not reopened by a later live update", () => {
  const fn = html.slice(html.indexOf("async function openDrawer(id)"), html.indexOf("async function markFp("))
  expect(fn).toMatch(/catch \(e\) \{ openDrawerId = null; return toast\(e\.message, "error"\) \}/)
  expect(fn).toMatch(/if \(openDrawerId !== id\) return/)
})
