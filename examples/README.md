# Examples

| File | Shows |
|---|---|
| `contract-enumerable.json` | a finite list of cases, with one command that runs them |
| `contract-bounded.json` | a universal claim over a corpus at a fingerprint: the gate-rewrite story, where the corpus of commands with their verdicts before and after is the standard |
| `contract-structural.json` | the same claim closed by construction: a release list at a fingerprint plus one invariant |
| `contract-judgment.json` | a condition no machine decides, with condition checks only |
| `contract-mixed.json` | the README contract: all four kinds on one unit of work |
| `chains/extension-then-close/` | contract revision 1, bounded; an AGC round that probes outside the domain and escalates with grow, close and narrow; revision 2, structural; an AGC round that allows |
| `invalid/` | one contract per **[V]** rule it breaks. `expected.json` names the rule. |
| `invalid-chains/` | chains that break a §3, §6 or §8 rule: a `block` at the extension budget, a second extension round past it, a `condition` probe on a bounded criterion, an extension patched by the builder, a round that names no revision, and a skipped revision |

A chain directory holds contracts (objects with `aac`) and AGC responses (objects with `agc`). Rounds are read in file-name order, and each round names the revision it judged against in `gate.version`.
