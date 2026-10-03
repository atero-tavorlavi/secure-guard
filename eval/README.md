# Secure Guard / LAYA reasoning-ablation eval

Measures how `recent_turns` and `reasoning` each affect the LAYA `malicious.noul` risk
score on the 80 hand-labeled tool-call samples from
`.superpowers/sdd/2026-10-03-laya-guard/inv-retune-reasoning-set-{T,V}.json` (see
`inv-retune-reasoning.md`'s method section for how those samples were written and
labeled). State construction, question text and field budgets are a direct port of
`src/scanner/laya.ts` (`toolCallStates`, `questionsFor`, `stateBudgetChars`) -- not a
re-derivation -- so the "full" variant reproduces the production code path exactly.

## Layout

- `data/set-T.json`, `data/set-V.json` -- copies of the labeled sample sets (25 benign +
  15 attack each).
- `score_tool_calls.py` -- loads `typed-decisions` once, builds the four input variants
  per sample (`full`, `no_reasoning`, `no_turns`, `neither`), calls `agent.predict`, and
  writes raw per-sample scores to `results/scores.json`.
- `analyze.py` -- reads `results/scores.json` and computes, for Set V and for T+V
  pooled: ROC-AUC per variant with 95% bootstrap CIs, a paired bootstrap of the AUC
  difference (full vs. no_reasoning, full vs. no_turns), catch rate / FP rate with
  Wilson 95% CIs at thresholds 0.25/0.35/0.45/0.5 (full variant), and calibration of the
  full variant (ECE with 5 equal-width and 5 equal-count bins, a reliability table,
  Brier score). Writes `results/summary.md` (+ `results/summary.json` with the same
  numbers machine-readable).
- `results/scores.json`, `results/summary.md` -- outputs of the two scripts above.

## Running

Scoring loads the LAYA model and must run with the memory/time guardrails, in the
foreground, one at a time:

```sh
memory_pressure | tail -1   # confirm >= 40% free first
~/laya-vs-qwen/tools/limit.sh -m 8 -t 1800 -- \
  ~/laya-vs-qwen/.venvs/laya/bin/python score_tool_calls.py --out results/scores.json
```

Analysis is pure numpy/stdlib (no model, no sklearn/scipy available in the venv -- AUC,
bootstrap and Wilson CIs are implemented directly) and is cheap to run directly:

```sh
~/laya-vs-qwen/.venvs/laya/bin/python analyze.py --scores results/scores.json --out results/summary.md
```

## Notes

- All 80 samples, under every variant, fit well inside the ~2300-char state budget
  (max observed: 1243 chars) -- the args-windowing overflow branch in `laya.ts` never
  triggers here, so `score_tool_calls.py` only ports the non-overflow branch of
  `toolCallStates` (with an assertion that would fail loudly if a future sample set
  changed that).
- Reproduction: the "full" variant's per-sample risk scores are bit-for-bit identical
  to the earlier tuning investigation's `inv-retune-reasoning-results.json`
  (`T_with_reasoning` / `V_with_reasoning`), confirming this harness reconstructs state
  the same way production does. See `results/summary.md` for the numeric check.
