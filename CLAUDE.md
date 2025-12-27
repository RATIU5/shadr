This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Commands

```bash
# Development
pnpm dev:app              # Run SolidStart app (localhost:3000)
pnpm dev:packages         # Watch & rebuild all @shadr/lib-* packages

# Code quality
pnpm format               # Format with Biome
pnpm check                # Lint & fix with Biome
pnpm typecheck            # TypeScript check (no emit)

# Maintenance
pnpm clean                # Remove node_modules and dist from all packages
```

## Architecture

**Monorepo** using pnpm workspaces:

- `app/` - SolidStart app (Vinxi-based) with WebGPU canvas
- `packages/editor/` - `@shadr/lib-editor` - WebGPU editor library using TypeGPU

**Stack**: SolidJS + SolidStart | TypeGPU (WebGPU abstraction) | Biome (formatting/linting) | tsup (library bundling)

**Key patterns**:

- Client-only components use `.client.tsx` suffix and are lazy-loaded with Suspense
- Editor library exports `initCanvas()` which initializes WebGPU context via TypeGPU
- Libraries use ESM-only output with TypeScript declarations

## Code Style

- Biome handles formatting (tabs, double quotes) and linting
- Imports are auto-organized by Biome
- Node >=22 required for the app

## WebGPU/TypeGPU Documentation

This project uses **sls** (Starlight Search) for WebGPU and TypeGPU documentation lookup.

### Quick Reference

```bash
sls search -d https://webgpu-llm-docs.vercel.app "<query>"  # Search docs
sls show "<llmsTxt-url>"                                     # Fetch full content
```

### Usage Rules

- **Always search before implementing** WebGPU/TypeGPU code
- **Use 1-3 word queries**: "buffers", "compute pipelines", "bind groups"
- **Search concepts, not sentences**: "texture sampling" not "how do I sample a texture"
- **Fetch full docs** with `sls show` using the `llmsTxt` URL from results

### Example Session

```bash
# Find buffer documentation
sls search -d https://webgpu-llm-docs.vercel.app "buffers"

# Fetch the full content
sls show "https://webgpu-llm-docs.vercel.app/data-and-buffers/buffers-memory-management/_llms-txt"
```

### Workflow

1. When working with WebGPU or TypeGPU code, search for the relevant concept
2. Extract the `llmsTxt` URL from search results
3. Fetch and read the full documentation with `sls show`
4. Apply the patterns and examples to the current task

### Topic Coverage

| Area         | Topics                                                |
| ------------ | ----------------------------------------------------- |
| Fundamentals | Device initialization, adapters, canvas configuration |
| Data         | Buffers, memory management, data schemas              |
| Shaders      | WGSL, TGSL functions, compute/render pipelines        |
| Resources    | Bind groups, layouts, textures, samplers              |
| TypeGPU      | Type-safe abstractions, slots, derived values         |

### When to Search

- Before implementing any WebGPU API calls
- When encountering GPU-related errors
- When optimizing render or compute pipelines
- When working with TypeGPU's type system

<!-- effect-solutions:start -->

## Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.

<!-- effect-solutions:end -->
