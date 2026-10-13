# Contributing

A change to the contract needs evidence, as every rule in `SPEC.md` has. Open an issue first with:

1. the loop the change ends or prevents;
2. a measurement, or a reproducible case, that shows the loop;
3. the spec text you propose.

Every pull request must keep `yarn test` and `yarn validate` green. A new **[V]** rule needs one invalid example under `examples/invalid/` or `examples/invalid-chains/`, listed in `examples/invalid/expected.json`, and a valid example that passes.

New bindings are welcome in `BINDINGS.md`. Mark each one verified only when it was checked against the other system's own files or documentation, and link them.
