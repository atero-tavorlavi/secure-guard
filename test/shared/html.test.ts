import { expect, test } from "bun:test"
import { escapeHtml } from "../../src/shared/html"

test("escapes all five HTML-significant characters", () => {
  expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;")
})
