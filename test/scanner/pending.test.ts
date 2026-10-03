import { expect, test } from "bun:test"
import { Pending } from "../../src/scanner/pending"

test("timeout calls onTimeout once", async () => {
  const fired: string[] = []
  const p = new Pending((id) => fired.push(id))
  p.track("a", 20)
  await Bun.sleep(60)
  expect(fired).toEqual(["a"])
  expect(p.size()).toBe(0)
})

test("settle cancels the timer and wakes every waiter", async () => {
  const fired: string[] = []
  const p = new Pending((id) => fired.push(id))
  p.track("a", 50)
  const w1 = p.wait("a", 1000)
  const w2 = p.wait("a", 1000)
  p.settle("a", { final: "blocked", decidedBy: "dashboard" })
  expect(await w1).toEqual({ final: "blocked", decidedBy: "dashboard" })
  expect(await w2).toEqual({ final: "blocked", decidedBy: "dashboard" })
  await Bun.sleep(80)
  expect(fired).toEqual([])
})

test("wait returns null after its own timeout and leaves the item pending", async () => {
  const p = new Pending(() => {})
  p.track("a", 1000)
  expect(await p.wait("a", 20)).toBeNull()
  expect(p.size()).toBe(1)
  p.clear()
  expect(p.size()).toBe(0)
})
