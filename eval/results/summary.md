# Secure Guard / LAYA reasoning-ablation eval -- summary

Calibration figures below are the calibration of LAYA's `malicious.noul` output (interpreted as P(malicious)) against the hand-written attack/benign labels, on 80 samples total -- small enough that all calibration numbers should be read as indicative, not precise estimates.

## Set V (validation, held out) (n=40, 15 attack / 25 benign)

### ROC-AUC per variant (95% bootstrap CI, 2000 stratified resamples, seed 0)

| variant | AUC | 95% CI |
|---|---|---|
| full | 0.8093 | [0.6480, 0.9307] |
| no_reasoning | 0.6347 | [0.4453, 0.7947] |
| no_turns | 0.9307 | [0.8187, 1.0000] |
| neither | 0.6560 | [0.4853, 0.8187] |

### Paired bootstrap AUC difference (full − other, same resamples)

| comparison | Δ AUC | 95% CI | CI excludes 0? |
|---|---|---|---|
| full_vs_no_reasoning | +0.1747 | [+0.0653, +0.3040] | yes |
| full_vs_no_turns | -0.1213 | [-0.2827, +0.0320] | no |

### Catch rate (recall) and false-positive rate, full variant (Wilson 95% CI)

| threshold | catch rate | catch 95% CI | FP rate | FP 95% CI |
|---|---|---|---|---|
| 0.25 | 1.000 (15/15) | [0.796, 1.000] | 0.640 (16/25) | [0.445, 0.798] |
| 0.35 | 0.400 (6/15) | [0.198, 0.643] | 0.000 (0/25) | [0.000, 0.133] |
| 0.45 | 0.133 (2/15) | [0.037, 0.379] | 0.000 (0/25) | [0.000, 0.133] |
| 0.5 | 0.000 (0/15) | [0.000, 0.204] | 0.000 (0/25) | [0.000, 0.133] |

### Calibration, full variant -- Brier score = 0.2099

ECE (5 equal-width bins) = **0.0974**

| bin | predicted range | mean predicted | observed attack rate | count |
|---|---|---|---|---|
| 0 | [0.00, 0.20] | 0.165 | 0.000 | 2 |
| 1 | [0.20, 0.40] | 0.287 | 0.343 | 35 |
| 2 | [0.40, 0.60] | 0.462 | 1.000 | 3 |
| 3 | [0.60, 0.80] | n/a | n/a | 0 |
| 4 | [0.80, 1.00] | n/a | n/a | 0 |

ECE (5 equal-count bins) = **0.2811**

| bin | risk range (observed) | mean predicted | observed attack rate | count |
|---|---|---|---|---|
| 0 | [0.154, 0.245] | 0.212 | 0.000 | 8 |
| 1 | [0.248, 0.278] | 0.263 | 0.500 | 8 |
| 2 | [0.281, 0.296] | 0.288 | 0.000 | 8 |
| 3 | [0.301, 0.325] | 0.315 | 0.500 | 8 |
| 4 | [0.326, 0.487] | 0.392 | 0.875 | 8 |

## Set T+V pooled (n=80, 30 attack / 50 benign)

### ROC-AUC per variant (95% bootstrap CI, 2000 stratified resamples, seed 0)

| variant | AUC | 95% CI |
|---|---|---|
| full | 0.8270 | [0.7207, 0.9097] |
| no_reasoning | 0.6387 | [0.5173, 0.7513] |
| no_turns | 0.9363 | [0.8633, 0.9893] |
| neither | 0.7060 | [0.5913, 0.8173] |

### Paired bootstrap AUC difference (full − other, same resamples)

| comparison | Δ AUC | 95% CI | CI excludes 0? |
|---|---|---|---|
| full_vs_no_reasoning | +0.1883 | [+0.1033, +0.2860] | yes |
| full_vs_no_turns | -0.1093 | [-0.2073, -0.0180] | yes |

### Catch rate (recall) and false-positive rate, full variant (Wilson 95% CI)

| threshold | catch rate | catch 95% CI | FP rate | FP 95% CI |
|---|---|---|---|---|
| 0.25 | 1.000 (30/30) | [0.886, 1.000] | 0.680 (34/50) | [0.542, 0.792] |
| 0.35 | 0.367 (11/30) | [0.219, 0.545] | 0.020 (1/50) | [0.004, 0.105] |
| 0.45 | 0.100 (3/30) | [0.035, 0.256] | 0.000 (0/50) | [0.000, 0.071] |
| 0.5 | 0.033 (1/30) | [0.006, 0.167] | 0.000 (0/50) | [0.000, 0.071] |

### Calibration, full variant -- Brier score = 0.2096

ECE (5 equal-width bins) = **0.0907**

| bin | predicted range | mean predicted | observed attack rate | count |
|---|---|---|---|---|
| 0 | [0.00, 0.20] | 0.172 | 0.000 | 3 |
| 1 | [0.20, 0.40] | 0.290 | 0.347 | 72 |
| 2 | [0.40, 0.60] | 0.477 | 1.000 | 5 |
| 3 | [0.60, 0.80] | n/a | n/a | 0 |
| 4 | [0.80, 1.00] | n/a | n/a | 0 |

ECE (5 equal-count bins) = **0.2068**

| bin | risk range (observed) | mean predicted | observed attack rate | count |
|---|---|---|---|---|
| 0 | [0.154, 0.248] | 0.219 | 0.000 | 16 |
| 1 | [0.250, 0.280] | 0.262 | 0.375 | 16 |
| 2 | [0.281, 0.304] | 0.291 | 0.188 | 16 |
| 3 | [0.306, 0.329] | 0.317 | 0.375 | 16 |
| 4 | [0.332, 0.592] | 0.396 | 0.938 | 16 |

## Reproduction check against the prior tuning run

Prior result (inv-retune-reasoning.md, full variant): AUC T = 0.8373, AUC V = 0.8093.
This run: AUC T = 0.8373, AUC V = 0.8093.
Max abs per-sample risk difference, full variant, T: 0.000000; V: 0.000000.

Per-sample risk scores are bit-for-bit identical to the prior run (max abs diff < 1e-6 on both sets), so the AUCs reproduce exactly: inference is deterministic given the same checkpoint, question set and state, and this harness builds the state the same way `src/scanner/laya.ts` does.

## Conclusions

On V, the full variant AUC is 0.809 [0.648, 0.931]; dropping reasoning (no_reasoning) gives 0.635 [0.445, 0.795], and dropping turns (no_turns) gives 0.931 [0.819, 1.000]; with neither, 0.656 [0.485, 0.819]. The paired full-vs-no_reasoning AUC difference is +0.175 [+0.065, +0.304] (significant: full beats no_reasoning), and full-vs-no_turns is -0.121 [-0.283, +0.032] (CI includes 0). 

This is the opposite of the natural assumption that more context always helps: on V, dropping `recent_turns` (no_turns) scores a *higher* point-estimate AUC (0.931) than the full variant (0.809), i.e. the sign of full_vs_no_turns is negative, not positive. On V alone the CI for that difference still straddles zero ([-0.283, +0.032], n=40, so not significant there), but on the pooled 80-sample set the same comparison is -0.109 [-0.207, -0.018], which does exclude zero -- with more power this reads as `recent_turns` genuinely hurting AUC in this harness, not helping it. Reasoning shows the opposite and consistent pattern: full beats no_reasoning on both V (significant) and pooled (significant, +0.188). Net read: **reasoning is the field doing the work; `recent_turns` is not helping and may be actively hurting**, the opposite of what 'add more context' would predict -- worth flagging to reviewers rather than assuming both ablated fields pull the same way. Calibration (full variant) is poor in absolute terms: LAYA's `malicious.noul` output clusters in a narrow ~0.15-0.49 band (see reliability tables above) rather than spreading across [0, 1], so ECE and Brier describe that narrow-band miscalibration and should be read as indicative only, given the 80-sample size.