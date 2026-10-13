# Agent Acceptance Contract (AAC)

**Your builder passed every test in its brief. The judge wrote its own probe, found one more case, and sent the work back. Thirteen rounds later the list was still growing.**

A task has two "done" conditions and only one is written down. The builder's brief defines done as a finite list: the tests, the fixtures, the corpus it must pass. The judge is told to re-derive the standard from the spec and to fail when in doubt, so it judges the spec's universal rule. It writes its own probes, finds one case the list does not hold, and sends the task back. The list grows by that case. The next round finds the next one. The loop has no closing condition, because a finite list cannot prove a universal claim. Measured in one production harness, **one feature went through 13 fix rounds after its gate code first went green, and the loop closed only when the owner narrowed the claim, not when the list grew.** See [EVIDENCE.md](EVIDENCE.md).

AAC is the sibling of the [Agent Gate Contract](https://github.com/abbaseya/agent-gate-contract) (AGC). **AGC says how a gate answers. AAC says what it judges against,** declared once before the work, in one object that the agent that builds and the gate that judges both hold.

What AAC is not. "Acceptance contract" is a crowded phrase, so three lines first:

- **Not a tool.** It is a schema, a validator and examples. Tools can adopt it.
- **Not a receipt.** It is declared before the work, not produced after it.
- **Not self-declared by the builder.** The authority, a spec, a plan or a ticket, names the criteria. The builder and the judge receive the same object.

## One contract

The contract below is the public form of the measured feature: four security gates rewritten from matching command text to matching the action a command performs. Four criteria, one of each kind.

```json
{
  "aac": "0.1",
  "contract": {
    "id": "gate-rewrite",
    "revision": 1,
    "fingerprint": "sha256:b790a9d72bf1"
  },
  "subject": {
    "kind": "diff",
    "scope": [
      "hooks/gates/",
      "corpus/",
      "policy/"
    ]
  },
  "authority": {
    "kind": "spec",
    "ref": "spec:gate-rewrite"
  },
  "criteria": [
    {
      "id": "gate-rewrite/success-line",
      "statement": "The five example commands in the success line get the verdict the line states.",
      "authority": "CAP-1",
      "kind": "enumerable",
      "class": "example-verdict-mismatch",
      "cases": {
        "ids": [
          "cd-worktree",
          "status-in-main",
          "rm-outside-scope",
          "curl-pipe-shell",
          "env-dump"
        ]
      },
      "checks": [
        {
          "kind": "command",
          "run": "node scripts/gate-check.js --cases success-line"
        }
      ],
      "owner": "spec owner"
    },
    {
      "id": "gate-rewrite/no-regression",
      "statement": "No command that the four gates blocked before the rewrite passes after it.",
      "authority": "CAP-2",
      "kind": "bounded",
      "class": "blocked-command-passes",
      "domain": {
        "artifact": "corpus/gate-verdicts.jsonl",
        "fingerprint": "sha256:4e1d9b0c72af",
        "row": "A row is one command with its verdict before the rewrite and the verdict required after it; the spec owner adds a row in a new revision."
      },
      "checks": [
        {
          "kind": "command",
          "run": "node scripts/gate-corpus.js corpus/gate-verdicts.jsonl"
        }
      ],
      "owner": "spec owner"
    },
    {
      "id": "gate-rewrite/release-list",
      "statement": "An argument is released as data only when its shape is in the release list, and no released shape is an interpreter body.",
      "authority": "CAP-3",
      "kind": "structural",
      "class": "interpreter-body-released",
      "construction": {
        "list": {
          "artifact": "policy/release-list.json",
          "fingerprint": "sha256:a7c3e05d1b94"
        },
        "invariant": "No entry of the release list is a body an interpreter would execute."
      },
      "checks": [
        {
          "kind": "command",
          "run": "node scripts/release-list-check.js policy/release-list.json"
        },
        {
          "kind": "condition",
          "condition": "Every entry of the release list is one finite argument shape with a case in the corpus, and none is a body an interpreter would execute."
        }
      ],
      "owner": "spec owner"
    },
    {
      "id": "gate-rewrite/message-names-action",
      "statement": "A block message names the action the command performs, not the text the gate matched.",
      "authority": "CAP-4",
      "kind": "judgment",
      "class": "message-names-text",
      "checks": [
        {
          "kind": "condition",
          "condition": "A reader of the block message can say which action was refused without seeing the matched text."
        }
      ],
      "owner": "spec owner"
    }
  ],
  "budget": {
    "extensions": 1
  }
}
```

The `bounded` criterion is the one that looped. Its claim is universal, "no command that the gates blocked before passes now", so its proof is a corpus at a fingerprint, not a list of examples. A probe on a row the corpus does not hold is not a defect for the builder. It is an **extension**: it goes to the spec owner, who answers with a new revision in one of three ways, grow, close or narrow. [`examples/chains/extension-then-close/`](examples/chains/extension-then-close/) shows that round, and the revision that closed the claim with a `structural` criterion instead of a longer list.

## What the contract requires

| Rule | Loop it ends |
|---|---|
| **One object for both sides**, referenced by `contract.id` and `contract.fingerprint` | the builder and the judge working to two standards |
| **Every criterion declares its `kind`:** `enumerable`, `bounded`, `structural` or `judgment` | a universal claim "proven" by five examples |
| **A universal claim is `bounded` or `structural`, never `enumerable`** | the list that grows by one case per round |
| **A probe is a runnable `command` on a row the domain holds,** never a sentence | prose checks the builder cannot run, and private probe corpora |
| **A finding outside the contract is an extension,** with its own budget, routed to the contract's owner | the builder fixing cases nobody declared |
| **At the extension budget the gate escalates** with three answers: grow, close or narrow | rounds with no closing condition |
| **The builder runs every non-judgment check before it says done** | a first judge round spent on what a command would have shown |

[SPEC.md](SPEC.md) is the normative reference. [BINDINGS.md](BINDINGS.md) maps the contract onto AGC, spec kernels and tickets, orchestrators and CI.

## Validate

```bash
yarn install
yarn test                                   # the validator's own tests
yarn validate                               # every example in examples/
node scripts/validate-examples.js my.json   # one contract
node scripts/validate-examples.js --chain rounds/   # contract revisions and the AGC rounds judged against them
```

The validator checks the JSON Schema and the rules a schema cannot express. Those rules are marked **[V]** in the spec:
- the fingerprint matches the criteria, and revisions are consecutive with a changed fingerprint;
- ids and classes are unique, and each kind carries the checks and the list, domain or construction it needs;
- a blocking finding against a non-judgment criterion carries a `command` check on a case the contract holds;
- an extension is never dispatched to the builder, and at the extension budget the gate escalates with grow, close and narrow;
- each round names the revision it judged against.

`validateContract(contract)` returns errors and warnings. `validateAgainst(contract, agcResponse)` classifies each finding as against a criterion or an extension and enforces the probe rule. `validateChain(contracts, responses)` checks revisions, fingerprints and the extension budget. The AGC response itself is validated by [AGC's validator](https://github.com/abbaseya/agent-gate-contract); this one reads only the fields AAC links to.

## Layout

| Path | What |
|---|---|
| `SPEC.md` | the normative specification |
| `EVIDENCE.md` | the measurement behind each rule, and the landscape |
| `BINDINGS.md` | AGC, spec kernels and tickets, orchestrators, CI |
| `schema/aac.schema.json` | JSON Schema 2020-12 |
| `examples/` | one contract per kind, a mixed one, an extension-then-close chain, and invalid cases with the rule each breaks |
| `packages/validator` | `validateContract`, `validateAgainst` and `validateChain` |

## Status

Draft 0.1. Field names may still change before 1.0. The done report of §7 has no object yet. Bindings are non-normative. The website will be [aacos.dev](https://aacos.dev); it is registered and not yet live.

## Related

- [Agent Gate Contract](https://github.com/abbaseya/agent-gate-contract) standardises the gate's answer. AAC standardises what the gate judges against, and links a finding to a criterion through the AGC `class`.

## License

[MIT](LICENSE).
