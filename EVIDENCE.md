# Evidence

Each rule in `SPEC.md` that cites an `E-n` comes from one measurement on this page.

## Source

One developer's production harness, built on an AI coding agent with deterministic gates (pre-tool hooks) and judgment gates (review, audit and readiness agents). One feature run, from 2026-10-12 to 2026-10-13, that rewrote four security gates from matching command text to matching the action a command performs.

The gates in that harness already answered in the AGC shape: stable finding ids, remedies, coverage and an attempt budget. The loop below happened **with** that shape in place. AGC governs the gate's answer. The question the gate asked was never a shared object.

The raw transcripts are private. This page publishes the method and the aggregates.

## Method

1. **Two standards.** The spec, the builders' briefs and the judges' briefs were read for their definition of done.
2. **Rounds.** Fix rounds were counted from the branch log, from the first green of the gate code to the end of the run.
3. **Cost.** Whole runs of the hook test suite were counted by their dispatch commands. Two runs printed their own time, and those two give the median.
4. **Closing.** The round at which the loop was escalated, and the decision that closed it, were read from the orchestrator's escalation and the owner's answer.

## Results

| Measurement | Value |
|---|---|
| corpus rows at the first green of the gate code | 562, of which 58 failing |
| fix rounds after the first green | 13 |
| rows added by the fix round after the first green | 70 |
| whole runs of the hook test suite | 30 |
| median run time, from the two runs that printed it | 5.6 minutes |
| runs that hit the 10-minute tool timeout | 4 |
| review round at which the loop was escalated | 3 |

## The evidence items

- **E-1 — two standards for one task.** The spec stated the safety property as a universal in its constraints: no command that the gates blocked before may pass now. Its success line gave five example commands. The builders' briefs defined done as "tests that must pass", with a corpus of commands and their base verdicts as the standard. The corpus started at 562 rows with 58 failing. The judges judged the universal. Counted from the branch log, 13 fix rounds followed the first green of the gate code. Each one added the cases the judges had found. The next fix round alone added 70 rows.
- **E-2 — private probes and prose checks.** The judge's brief told it to re-run "your own differential probes from round 1" from its own temporary directory. The builder never had them. The judge's verdict: "None of the loss shapes from my findings is in the corpus, so these tests never exercise them." The reviewer's three blocking findings carried `check.kind: condition`, prose the builder cannot run, and AGC §7.2 allows that for a judgment gate. The next test-writer brief said to add "every loss shape the last audits found", "plus siblings you judge the same class". Cost of each round: the hook test suite ran whole 30 times in the run, counted by its dispatch commands. Two of those runs printed their own time, median 5.6 minutes. Four hit the 10-minute tool timeout. An earlier count by another method gave 52 runs. It was not reproduced, so this page cites 30 and the method.
- **E-3 — the loop closed when the claim was bounded, not when the list grew.** At review round 3 the orchestrator escalated to the owner: "Each round found new language-feature escapes around a finite list, so a fourth list round has no closing condition." The owner chose to narrow the claim: interpreter bodies are never released as data. That turned a universal rule into a closed one. A declaration-time check would have produced the same decision before the first build round, because the release entry "a body whose every process call is decided" is itself a universal claim over a programming language, and not a valid entry of a closed list.
- **E-4 — sibling findings evade the still-open rule.** AGC §10 says a gate SHOULD escalate early when the same class is still-open in two consecutive rounds. Each new escape sat at a new symbol, so it got a new finding id with status `new`. No chain escalated early. Every chain ran to its budget. A criterion id is the stable key that class recurrence needs.
- **E-5 — the residual AGC did not claim.** AGC's own measurement, in its [`EVIDENCE.md`](https://github.com/abbaseya/agent-gate-contract/blob/main/EVIDENCE.md), labelled 8 repeat rounds "missed by an earlier round" (1.9 h, not counted), 17 "new work since the last round" (3.2 h, real work) and 6 "another instance of a reported class" (2.2 h). The mechanism in E-1 produces rounds under all three labels whenever the judge's standard exceeds the builder's written done condition. Re-labelling those 31 rounds with that one question is the after-measurement for AAC. It has not been run.

## Landscape

Every item was read from its primary source on 2026-10-13.

**Tools that use the phrase.** None is a standard.

- [OpenWorkProof](https://github.com/dengyier/OpenWorkProof) (v1.4.0, Apache-2.0, on PyPI and the MCP registry): a protocol for agent work contracts with authorization, evidence, verification and acceptance kept apart, and signed evidence bundles. The closest thing to a standard. It does not declare a criterion's decidability, and it does not share one criterion object between builder and judge before the work.
- [ToppleCat](https://github.com/samzhu/topplecat) (0.2.2, Apache-2.0): "executable acceptance contracts" for Java, with hidden retests and mutation gates. A tool, not a standard.
- [Carthagent](https://github.com/B-icy/Carthagent) (v1.0.1, MIT): "the agent declares an acceptance contract, runs real checks". Self-declared by the builder, the inverse of AAC.
- [LabReceipt](https://github.com/sepfivepencer/labreceipt), [ShipProof](https://github.com/lianmt/shipproof), [proof-of-done](https://github.com/lykAntonio/proof-of-done) and [Coordination Memory](https://github.com/yanqiw/comem): "acceptance contracts" as evidence receipts for agent deliverables. Tools.
- [Developer Toolkit, acceptance criteria](https://developertoolkit.ai/en/workflows/plan/acceptance-criteria/): acceptance tests "approved by a human, then locked outside the implementing agent's edit scope". The enumerable kind, by hand.
- [Aviator Verify](https://docs.aviator.co/verify/how-it-works): "The agent generates both from what was actually built." The inverse of AAC.
- [DeepSWE](https://arxiv.org/abs/2607.07946) (Huang, Lee, Tng and Ge, 2026), §4.3: reviewers check the "prompt-verifier bijection", that "the verifier should test exactly the functionality the prompt asks for, no more, no less. A verifier that tests more produces false negatives (an agent solves the stated task but fails an unstated one); a verifier that tests less produces false positives". The judge's private probes in E-2 are the first case.
- The [three amigos](https://www.agilealliance.org/glossary/three-amigos/) of BDD and ATDD, "the primary perspectives to examine an increment of work before, during, and after development", business, development and testing: the human analogue of one shared acceptance object.
- [SWE-bench](https://arxiv.org/abs/2310.06770) (Jimenez et al., ICLR 2024), Table 9: a task instance carries `FAIL_TO_PASS`, the tests that change from fail to pass, and `PASS_TO_PASS`. The enumerable kind only.

No published standard was found, as of 2026-10-13, that declares a criterion's decidability, shares one criterion object between the builder and the judge before the work, and links a gate's finding to the criterion it fails.

## Limits

- **One run, one developer, one harness.** The shape is credible. The counts will move elsewhere.
- **Two counting methods.** The 13 fix rounds come from one branch log. The 30 suite runs come from one counting method, stated in E-2, and an earlier count by another method gave 52.
- **E-5 is a residual from a published measurement, not a measurement of AAC.** The after-numbers do not exist yet.
- **No prior standard was found, but the phrase is crowded.** The landscape above positions AAC against the tools that use it.
