# Fix Plan

Last updated: 2026-01-16
Targets reference: `targets.md` (one task at a time)

> Run `.ralph/ralph-plan.sh` to analyze the codebase and update this list.

## Critical

- [ ] Fix `pnpm typecheck` failing due to invalid CLI flag (`package.json:12` uses `tsc --no-emit`, should be `--noEmit`)

## High Priority

- [ ] Implement infinite grid rendering and camera container setup in Pixi app init (`packages/editor/src/index.ts:1`)
- [ ] Add pan (pointer drag) and zoom (wheel) interactions for the grid/camera (`packages/editor/src/index.ts:1`)

## Medium Priority

- [ ] Add tests for pan/zoom transform logic to prevent regressions once camera controls land (new test file under `packages/editor/`)

## Low Priority

<!-- ready to be populated -->

## Completed

<!-- Move completed items here with date -->

- [x] Ensure `initCanvas` uses Pixi.js and is exported from `@shadr/lib-editor` (`packages/editor/src/index.ts:1`, `app/src/components/editor.client.tsx:1`) - 2026-01-16
- [x] Remove WebGPU/TypeGPU dependencies and update editor initialization to Pixi.js (`packages/editor/package.json`, `packages/editor/src/index.ts:1`) - 2026-01-16
- [x] Update documentation to reflect Pixi.js renderer (`AGENT.md`, `specs/architecture.md`) - 2026-01-16
- [x] Add Pixi.js canvas lifecycle cleanup on unmount (`app/src/components/editor.client.tsx:1`) - 2026-01-16
