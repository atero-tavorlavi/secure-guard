import type { GuardEvent } from "../shared/types"

export class EventHub {
  private subs = new Set<(e: GuardEvent) => void>()

  subscribe(fn: (e: GuardEvent) => void): () => void {
    this.subs.add(fn)
    return () => this.subs.delete(fn)
  }

  broadcast(e: GuardEvent): void {
    for (const fn of this.subs) {
      try {
        fn(e)
      } catch (err) {
        console.error("[secure-guard] event subscriber failed:", err)
      }
    }
  }
}
