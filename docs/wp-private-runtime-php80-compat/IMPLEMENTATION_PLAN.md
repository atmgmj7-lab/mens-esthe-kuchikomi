# PHP 8.0 private runtime compatibility

Task: `WP-PRIVATE-RUNTIME-PHP80-COMPAT-01`.

1. Audit only the candidate coverage/private runtime, preactivation, official-facts, and price/Web-booking PHP added after `origin/main` for PHP 8.1+ dependencies.
2. Route the three `array_is_list()` call sites through a project-scoped helper that uses the native function when available and an ordered integer-key fallback on PHP 8.0.
3. Verify fallback/native equivalence, fail-closed mutations, focused runtime suites, PHP 8.0–8.3 syntax and execution, and the exact default production preactivation without rewriting private files.
4. Record a local commit and stop before push, deployment, WordPress writes, schema mutation, coverage apply, or reconciliation.
