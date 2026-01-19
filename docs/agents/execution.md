# Execution Model

- Pull-based and lazy
  - Nothing executes unless an output is requested
- Pure nodes only
  - Node output depends only on inputs and params
  - No side effects, IO, timers, or async
- Memoized
  - Per-node caching with dirty propagation
- Topologically sorted
  - Only upstream dependencies of requested output execute
- Deterministic
  - Same graph and inputs yield the same outputs
