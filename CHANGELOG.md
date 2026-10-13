# Changelog

## 0.1.1 — 2026-10-13 (draft)

- The validator package now carries the JSON Schema when it is packed, so a Yarn install from Git at a tag loads it. The specification and the schema are unchanged.

## 0.1.0 — 2026-10-13 (draft)

- First draft of the specification: the contract object, the criterion, the four kinds, rounds, extensions and the extension budget, the builder's obligation, both briefs and rendering.
- JSON Schema 2020-12 for the contract, with the check definition copied from AGC at tag v0.1.2.
- Validator for single contracts, AGC responses judged against a contract, and ordered chains of revisions and rounds, with tests over valid and invalid examples.
- Bindings for AGC, spec kernels and tickets, orchestrators and CI.
- Evidence from one production harness: one feature run, 13 fix rounds after the first green, closed by narrowing the claim.
