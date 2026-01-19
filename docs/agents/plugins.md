# Plugin System (Internal)

- Used for:
  - Node types
  - Socket types
  - UI widgets
- No third-party plugins
- Plugins register behavior; they do not mutate core state directly
- Node compute functions must remain pure
