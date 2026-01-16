# Ralph Wiggum Test Prompt - Shadr

Study the project context files:
- @AGENT.md for build/run instructions
- @fix_plan.md for current tasks
- Existing test files (if any)

## Your Task

Focus on expanding test coverage for the shadr project. Your goal is to ensure the codebase has comprehensive tests.

## Guidelines

1. **Analyze current coverage**: Use subagents to find:
   - Existing test files
   - Untested functions and components
   - Edge cases that need coverage

2. **Write meaningful tests**: For each test:
   - Document WHY the test exists and what it validates
   - Test behavior, not implementation details
   - Include edge cases and error scenarios
   - Use descriptive test names

3. **Test structure**: Follow this pattern:
   ```typescript
   describe('ModuleName', () => {
     /**
      * Tests for [functionality].
      * These tests ensure [what they validate].
      */
     describe('functionName', () => {
       it('should [expected behavior] when [condition]', () => {
         // Arrange
         // Act
         // Assert
       });
     });
   });
   ```

4. **Run tests after writing**: Verify tests pass and actually test what they claim.

5. **Update tracking**: Mark test-related items in @fix_plan.md as complete.

## Quality Standards

- Tests should be deterministic (no flaky tests)
- Tests should be fast
- Tests should be independent
- Mock external dependencies appropriately
- WebGPU tests may need special handling (browser environment)

## Completion Signal

When you've completed a meaningful unit of test work:
- Ensure all new tests pass
- Update @fix_plan.md
- Commit your changes
- If more test work needed, continue; otherwise: EXIT_SIGNAL: true
