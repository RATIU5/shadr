# Ralph Wiggum Infrastructure Prompt - Shadr

Study the project context files:
- @AGENT.md for build/run instructions
- @fix_plan.md for current tasks
- package.json files
- Existing CI/CD configuration (if any)

## Your Task

Focus on infrastructure improvements: build tooling, CI/CD, development experience.

## Areas to Consider

1. **Build optimization**:
   - Faster builds
   - Better caching
   - Parallel processing

2. **CI/CD pipeline** (.github/workflows/):
   - Type checking on PRs
   - Lint checking on PRs
   - Build verification
   - Test running (when tests exist)

3. **Development experience**:
   - Better error messages
   - Faster feedback loops
   - Documentation

4. **Code quality gates**:
   - Pre-commit hooks
   - Automated formatting
   - Dependency updates

## Guidelines

1. **Don't break existing functionality**: Test changes before committing.

2. **Keep it simple**: Prefer simple, maintainable solutions over complex ones.

3. **Document changes**: Update @AGENT.md with new commands or workflows.

4. **One improvement per iteration**: Focus on one infrastructure improvement at a time.

## Quality Standards

- CI workflows should complete in reasonable time (<5 min for basic checks)
- No secrets in configuration files
- Cross-platform compatibility where possible
- Clear error messages on failure

## Completion Signal

When you've completed an infrastructure improvement:
- Test the change works
- Update relevant documentation
- Commit your changes
- If more infra work needed, continue; otherwise: EXIT_SIGNAL: true
