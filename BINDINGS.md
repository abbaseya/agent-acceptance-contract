# Bindings

How an AAC contract travels through the systems around it. Bindings are **non-normative in 0.1**. A binding marked *verified* was checked against the other system's own files or documentation. A binding marked *open* is not yet written.

| System | Status |
|---|---|
| AGC | defined here, against [AGC 0.1.2](https://github.com/abbaseya/agent-gate-contract) |
| Spec kernels and tickets | defined here |
| Orchestrators, any runtime | defined here |
| CI | mapping defined. Open beyond `command` checks. |

## AGC

AAC links to AGC at three points and changes nothing in AGC 0.1.

**The class link.** A criterion's `class` is the AGC finding class a failure carries. A finding is against the criterion whose class it names. A blocking finding whose class matches no criterion is an extension (§6).

**The probe rule.** A blocking finding against an `enumerable`, `bounded` or `structural` criterion carries an AGC `check` of kind `command` whose `run` executes the case. Its `location` is the case: a case id, or `<artifact>@<fingerprint>#<row>`. A `condition` check on such a finding is invalid under AAC even though AGC §7.2 allows it for a judgment gate: the gate still judges, but the probe it reports lands as a row.

**The coverage rule.** `coverage.classes` lists every criterion class of the contract, so the response says which criteria were judged. `gate.version` is the contract fingerprint, so the response says which revision it judged against.

One AGC round against one contract. The contract is [`examples/chains/extension-then-close/contract-r1.json`](examples/chains/extension-then-close/contract-r1.json), one bounded criterion with class `blocked-command-passes` over a corpus at `sha256:4e1d9b0c72af` and an extension budget of 1. The judge probed a heredoc body that the corpus does not hold. The finding carries a `command` check, but its row is outside the declared domain, so it is an extension, and at the budget the gate escalates with the three answers:

```json
{
  "agc": "0.1",
  "gate": { "id": "gate-review", "kind": "judgment", "version": "sha256:c08e593e2296" },
  "subject": { "kind": "diff", "fingerprint": "sha256:2b7e9d40c1a5", "scope": ["hooks/gates/", "corpus/gate-verdicts.jsonl"] },
  "verdict": "escalate",
  "findings": [{
    "id": "gate-review/blocked-command-passes/corpus/probes.jsonl@sha256:9f20c1e4b7d3#heredoc-body",
    "class": "blocked-command-passes",
    "location": "corpus/probes.jsonl@sha256:9f20c1e4b7d3#heredoc-body",
    "what": "A destructive command inside a heredoc body passes the rewritten gates; the old gates blocked it on its text.",
    "why": "CAP-2: no command the gates blocked before the rewrite passes after it.",
    "severity": "blocking",
    "status": "new",
    "remedy": {
      "kind": "decide",
      "ask": "spec owner",
      "options": [
        "grow: add the heredoc row to corpus/gate-verdicts.jsonl in revision 2 and keep the claim bounded",
        "close: replace the universal claim with a closed release list and the invariant that no released shape is an interpreter body",
        "narrow: restate CAP-2 over the command shapes the corpus holds today"
      ]
    },
    "check": { "kind": "command", "run": "node scripts/gate-check.js --row corpus/probes.jsonl#heredoc-body" }
  }],
  "coverage": { "complete": true, "classes": ["blocked-command-passes"] },
  "attempt": { "n": 1, "budget": 3 }
}
```

The owner chose close. Revision 2 keeps the criterion id and class and makes the criterion `structural`: a release list at a fingerprint plus the invariant that no entry is an interpreter body. Round 2 names the new fingerprint in `gate.version`, carries the extension finding as closed, and allows.

**Proposals for AGC 0.2.** Nothing in AGC 0.1 changes. Two follow-ups are noted here for the next AGC draft:

- an optional `criterion` field on a finding, carrying the AAC criterion id, so a finding names its criterion directly instead of through the class;
- a note under AGC §10 that early escalation on class recurrence needs a stable key. In E-4 each sibling escape sat at a new symbol, so it got a new finding id with status `new`, and no chain escalated early. The criterion id is that key.

## Spec kernels and tickets in general

| Authority | `authority.ref` | criterion `authority` |
|---|---|---|
| a spec with capability ids | `spec:<id>` | `<capability id>`, such as `CAP-2` |
| a ticket | `ticket:<url>` | `ticket:<url>#<unit>` |
| a plan | `plan:<id>` | the plan's own unit id |

The `statement` copies the authority's wording. When the authority's unit is a universal claim and the contract writer makes it `bounded` or `structural`, the statement stays the authority's and the proof obligation lives in `domain` or `construction`.

## Orchestrators, any runtime

The brief rule of §8: the builder's brief and the judge's brief carry `contract.id`, `contract.fingerprint` and the contract object or its path. A runtime with a pre-dispatch hook can enforce it mechanically: refuse a builder or judge dispatch whose brief names no contract, or names a fingerprint that is not the latest revision.

The builder's obligation of §7: before the builder reports done, the runtime runs, or requires the builder to run, every `command` and `preview` check of the contract at its fingerprint, and attaches the results to the done report.

The extension rule of §6: a runtime that parses the judge's AGC response routes an extension to the criterion's `owner`, never to the builder, and at the budget shows the person the three answers.

## CI

Each `command` check maps to one job. The job runs `run` and fails on a non-zero exit status. A `bounded` check's job pins the domain artifact at its fingerprint and fails when the artifact's fingerprint has moved without a new contract revision. A `preview` check maps to the gate's preview mode, as AGC §11 defines it. A `condition` check has no job. The rest is open: a done-report object, and a job that validates a judge's response against the contract.
