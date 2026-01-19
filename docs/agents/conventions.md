# Code Patterns and Conventions

- Indentation: 2 spaces
- Quotes: double quotes
- Modules: ESM

Types:
- Strict TypeScript
- No `any`
- Prefer `unknown` with refinement
- Use branded IDs (`NodeId`, `SocketId`, etc.)

Exports:
- Prefer named exports
- Avoid default exports in libraries

Errors:
- Model domain errors, avoid arbitrary throws

Effects:
- Graph, execution, storage, and events are accessed via Effect services
- UI components call Effects through adapters or helpers
- Do not embed business logic directly in components

Best practices:
- Favor simplicity over complexity
- Favor minimalism over noise
