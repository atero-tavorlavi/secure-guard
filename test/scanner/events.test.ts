import { expect, test } from "bun:test"
import { EventHub } from "../../src/scanner/events"

test("broadcast reaches subscribers until they unsubscribe; one failing subscriber does not stop others", () => {
  const hub = new EventHub()
  const got: string[] = []
  hub.subscribe(() => {
    throw new Error("bad subscriber")
  })
  const off = hub.subscribe((e) => got.push(e.type))
  hub.broadcast({ type: "laya", ok: true })
  off()
  hub.broadcast({ type: "laya", ok: false })
  expect(got).toEqual(["laya"])
})
