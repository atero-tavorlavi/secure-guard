import type { Resolution } from "../shared/types"

// Timers decide when an unanswered item expires; waiters are long-poll requests
// (plugin, dashboard) parked until the item is settled. The Store, not this class,
// decides who wins: Guard calls settle() only after Store.finalize() succeeded.
export class Pending {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private waiters = new Map<string, Set<(r: Resolution | null) => void>>()

  constructor(private onTimeout: (id: string) => void) {}

  track(id: string, timeoutMs: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(id)
      this.onTimeout(id)
    }, timeoutMs)
    this.timers.set(id, timer)
  }

  settle(id: string, res: Resolution): void {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    const set = this.waiters.get(id)
    this.waiters.delete(id)
    for (const wake of [...(set ?? [])]) wake(res)
  }

  wait(id: string, timeoutMs: number): Promise<Resolution | null> {
    return new Promise((resolve) => {
      const set = this.waiters.get(id) ?? new Set()
      this.waiters.set(id, set)
      const wake = (r: Resolution | null) => {
        clearTimeout(timer)
        set.delete(wake)
        if (set.size === 0 && this.waiters.get(id) === set) this.waiters.delete(id)
        resolve(r)
      }
      const timer = setTimeout(() => wake(null), timeoutMs)
      set.add(wake)
    })
  }

  size(): number {
    return this.timers.size
  }

  clear(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    for (const set of this.waiters.values()) for (const wake of [...set]) wake(null)
    this.waiters.clear()
  }
}
