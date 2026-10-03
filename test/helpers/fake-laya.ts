export interface FakeAnswer {
  risk: number
  attackType?: string
  score?: number
}

type Answer = FakeAnswer | Response | Promise<FakeAnswer | Response>

export interface FakeLaya {
  url: string
  requests: any[]
  setAnswer(fn: (body: any) => Answer): void
  stop(): void
}

export function startFakeLaya(initial: (body: any) => Answer = () => ({ risk: 0.01 })): FakeLaya {
  let answer = initial
  const requests: any[] = []
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === "/health") return Response.json({ status: "ok" })
      if (url.pathname !== "/v1/systemone" || req.method !== "POST") return new Response("not found", { status: 404 })
      const body = await req.json()
      requests.push(body)
      const a = await answer(body)
      if (a instanceof Response) return a
      return Response.json({
        model: body.model,
        answers: {
          malicious: { noul: a.risk, confidence: 0.9 },
          attack_type: { choice: a.attackType ?? (a.risk >= 0.5 ? "destructive_action" : "none"), probabilities: {} },
          severity: { score: a.score ?? (a.risk >= 0.5 ? 3 : 0) },
        },
        usage: { input_tokens: 10, output_tokens: 0 },
      })
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    requests,
    setAnswer: (fn) => {
      answer = fn
    },
    stop: () => server.stop(true),
  }
}
