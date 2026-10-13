# Agent Acceptance Contract (AAC) Specification

**Version 0.1.0 — draft.** This is the single normative reference for the Agent Acceptance Contract. `README.md` is the tour, `EVIDENCE.md` is the measurement behind each rule, and [`schema/aac.schema.json`](schema/aac.schema.json) encodes the fields. [`packages/validator`](packages/validator) enforces the schema plus the rules a JSON Schema cannot express. The rules it checks are marked **[V]** below.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** follow [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## 1. Scope

A **criterion** is one condition a unit of work must meet to be accepted. A **contract** is the set of criteria for one unit of work, declared before the work starts.

AAC defines the contract object and the rules that make it the same standard for the builder and for every gate. It does not say what a criterion requires: the plan, the spec or the ticket does. It does not say how a gate answers: the [Agent Gate Contract](https://github.com/abbaseya/agent-gate-contract) (AGC) does. AAC sits between them. The authority names the criterion, AAC makes it judgeable, and AGC carries the verdict against it.

## 2. Design principles

A contract has one job: **give the builder and the judge one standard, with a finite proof obligation for every claim.** Four principles follow.

1. **One standard for both sides.** The builder and the judge MUST receive the same contract, verbatim, before the work. *(E-1)*
2. **Every claim declares its proof obligation.** A criterion MUST declare its `kind`. A universal claim with no finite proof obligation is invalid. *(E-3)*
3. **A probe is a row, not a sentence.** A finding against a non-judgment criterion MUST carry a runnable check, and its input MUST be in the contract's domain before it counts. *(E-2)*
4. **Out of contract is a contract event, not a defect.** A finding no criterion covers extends the contract. It has its own budget and goes to the contract's owner, never into the builder's fix loop. *(E-4, E-5)*

## 3. The contract object

A contract is one JSON object. JSON is the only normative representation.

| Field | Required | Meaning |
|---|---|---|
| `aac` | MUST | `"0.1"` |
| `contract` | MUST | `id`, stable per unit of work; `revision`, an integer from 1; `fingerprint`, `sha256:` plus the first 12 hex characters of the SHA-256 of the canonical JSON of `criteria` |
| `subject` | MUST | what the work is: `kind` from AGC §5 (`tool-call`, `diff`, `commit`, `artifact`, `pull-request` or `session`) and `scope`, the paths or units. There is no fingerprint, because the work does not exist yet |
| `authority` | MUST | where the criteria come from: `kind` (`spec`, `plan`, `ticket` or `other`) and `ref` |
| `criteria` | MUST, at least one | §4 |
| `budget` | MUST | `extensions`: the number of extension rounds allowed on one revision before the gate must escalate (§6). RECOMMENDED 1 |

Canonical JSON sorts object keys by code point at every depth and carries no insignificant whitespace. Strings, numbers and literals are written as `JSON.stringify` writes them.

- **[V]** The fingerprint MUST match the criteria. A changed criterion changes the fingerprint, so a stale brief is detectable (§8).
- **[V]** In a chain, revisions MUST be consecutive integers from 1, MUST share one `contract.id`, and each revision MUST carry a different fingerprint from the one before it. A revision changes the criteria; a change that leaves the criteria unchanged is not a revision.

*Evidence: E-1 (two standards for one task).*

## 4. Criterion

| Field | Required | Meaning |
|---|---|---|
| `id` | MUST | stable. RECOMMENDED `<contract.id>/<slug>`, or the authority's own criterion id when it has one. **[V]** Unique in the contract |
| `statement` | MUST | the canonical wording of done. It MUST be copied verbatim from the authority when the authority has one |
| `authority` | SHOULD | the unit inside the authority: a capability id, a plan criterion id or a ticket checkbox number |
| `kind` | MUST | `enumerable`, `bounded`, `structural` or `judgment` (§5) |
| `class` | MUST | the AGC finding class a failure carries. **[V]** Unique in the contract. This is the link to AGC |
| `cases` | MUST for `enumerable` | the finite list: `ids`, inline case ids, or `artifact` and `fingerprint`, a list file at a fingerprint |
| `domain` | MUST for `bounded` | `artifact`, `fingerprint`, and `row`, one sentence on what a row is and how one is added |
| `construction` | MUST for `structural` | `list`, an artifact path with its fingerprint, and `invariant`, one sentence |
| `checks` | MUST, at least one | AGC §7.2 check objects: `command` with `run`, `preview`, or `condition` with `condition` and optional `run` |
| `owner` | SHOULD | the role that may extend or decide the criterion |

An artifact fingerprint is `sha256:` plus the first 12 hex characters of the SHA-256 of the file's bytes.

- **[V]** `cases`, `domain` and `construction` are each present exactly when their kind requires them.
- **[V]** Checks by kind:
  - `enumerable` and `bounded`: every check is `command` or `preview`.
  - `structural`: at least one `command` and exactly one `condition`. The `condition` states the invariant.
  - `judgment`: every check is `condition`.

*Evidence: E-2 (prose checks the builder cannot run) and E-4 (a criterion id as the stable key).*

## 5. Kinds

| Kind | The claim | What proves it | A case outside it |
|---|---|---|---|
| `enumerable` | a finite list | every case passes | an extension |
| `bounded` | a universal statement restricted to a named domain artifact: a corpus of inputs with expected results | the check passes over the artifact at the declared fingerprint. The artifact is the standard | an extension |
| `structural` | a universal statement proven by construction: a closed list plus an invariant | the list is closed, each entry is justified by a case, and the invariant holds | a counterexample refutes the invariant. It is a finding against the criterion, with the counterexample as a `command` check. The fix is to the construction, never to the list alone |
| `judgment` | a condition no machine decides | the judge's reading | a finding against the criterion |

Reviewer rules. They are not **[V]**, because a schema cannot read a sentence:

- A statement whose scope is unbounded, one that says every, all, any, no, never or always, or that names no finite set, MUST NOT be `enumerable`.
- Each entry of a `structural` list MUST itself be enumerable or bounded. An entry that is a universal claim makes the criterion not structural. This is the rule that would have caught E-3 at declaration time.
- A criterion nobody can check before the work MUST be declared `judgment` or given a check. It MUST NOT be deferred to a later, unnamed human.
- The validator SHOULD return a warning, not an error, when an `enumerable` statement carries one of the words above.

*Evidence: E-3 (the loop closed when the claim was bounded).*

## 6. Rounds, extensions and the budget

A **round** is one AGC response judged against one contract revision. A **chain** is the sequence of revisions and rounds for one `contract.id`.

- A finding is **against** a criterion when its AGC `class` equals the criterion's `class` and its input is inside the criterion.
- The input of a finding is its AGC `location`. Against an `enumerable` criterion it is a case id, or `<artifact>@<fingerprint>#<case id>` when the cases are a file. Against a `bounded` criterion it is `<artifact>@<fingerprint>#<row>`, a row the domain artifact holds at the fingerprint the contract declares. A `structural` counterexample and a `judgment` finding locate freely.
- An **extension** is a blocking finding whose class matches no criterion, or whose input is outside an `enumerable` list or a `bounded` domain. An advisory finding is never an extension.
- **[V]** A blocking finding against an `enumerable`, `bounded` or `structural` criterion MUST carry a `command` check that runs its case. A `condition` check on such a finding is invalid. A probe on a row the domain does not hold at the declared fingerprint is not against the criterion; it is an extension.
- **[V]** An extension MUST NOT be dispatched to the builder as a fix. Its remedy is `delegate`, to the criterion's `owner`, or `decide`. A `rewrite`, `generate`, `patch` or `command` remedy on an extension is invalid. The owner answers with a new contract revision in one of three ways: **grow** (add the case, row or criterion), **close** (replace a universal claim with a structural one), or **narrow** (change the statement, which needs the authority's own revision).
- A round that carries at least one extension is an **extension round**. Extension rounds are counted per revision, because the owner's answer is a new revision and a new standard.
- **[V]** At `budget.extensions` extension rounds against one revision, the gate MUST `escalate` with a `decide` remedy whose options are grow, close and narrow. Each option starts with its answer's word.
- **[V]** Extension rounds against one revision MUST NOT exceed `budget.extensions`.
- Defect rounds are bounded by AGC's own `attempt` budget. The two budgets are orthogonal.

*Evidence: E-2 (private probes), E-4 (sibling findings evade the still-open rule) and E-5 (the residual AGC did not claim).*

## 7. The builder's obligation

Before it reports done, the builder MUST run every `command` and `preview` check of the contract at the contract's fingerprint, and report each result. A report without them is not a done report. This is AGC principle 3, every finding checkable before resubmission, applied before the build instead of after the finding. It is not **[V]**: the done report has no object in 0.1.

*Evidence: E-1 (a first judge round spent on what a command would have shown).*

## 8. Both briefs

The builder's brief and the judge's brief MUST carry `contract.id`, `contract.fingerprint` and the contract object or its path. A judge MUST NOT judge against a criterion the contract does not hold, except by raising an extension.

A gate that judges against a contract SHOULD set AGC `gate.version` to the contract fingerprint: the contract is the gate's rules, and AGC §4 says a change of rules is a change of version. AGC `coverage.classes` SHOULD list every criterion class of the contract, so coverage says which criteria were judged.

- **[V]** In a chain, each round's `gate.version` MUST equal the fingerprint of one revision of the contract, and a round MUST NOT be judged against an earlier revision than a round before it. A round that names no revision, or an older one, is a stale brief.
- The validator returns a warning when a single round omits `gate.version` or when its coverage omits a criterion class.

*Evidence: E-1 (the standard in the judge's brief exceeded the builder's).*

## 9. Rendering for people

A runtime that shows a contract to a person or to a model as text SHOULD render each criterion as `id`, `kind`, `statement`, then its checks in order. The judge's rendering adds one line: a finding cites a criterion's class, and anything else is an extension. The text MUST be derived from the object, never written separately from it.

## 10. Bindings

See [`BINDINGS.md`](BINDINGS.md). Bindings are non-normative in 0.1.

## Change history

See [`CHANGELOG.md`](CHANGELOG.md).
