# Feature: [Feature Name]

## Overview

Brief description of what this feature does and why it's needed.

## Requirements

### Functional Requirements

1. **FR-1**: [Requirement description]
2. **FR-2**: [Requirement description]
3. **FR-3**: [Requirement description]

### Non-Functional Requirements

1. **NFR-1**: Performance - [requirement]
2. **NFR-2**: Accessibility - [requirement]
3. **NFR-3**: Browser Support - [requirement]

## API / Interface

### Public API

```typescript
// Example interface
interface FeatureName {
  // Methods and properties
}
```

### Usage Example

```typescript
// How the feature will be used
import { feature } from "@shadr/lib-editor";

const result = feature.doSomething();
```

## Implementation Notes

### Approach

Describe the technical approach:
- What patterns to follow
- What existing code to build on
- What libraries to use

### Files to Create/Modify

- `packages/editor/src/feature-name.ts` - Main implementation
- `packages/editor/src/index.ts` - Export the feature
- `app/src/components/feature.client.tsx` - UI component (if needed)

### Dependencies

- List any new dependencies needed
- Or note if no new dependencies required

## Edge Cases

1. **Edge Case 1**: What happens when [scenario]?
   - Expected behavior: [description]

2. **Edge Case 2**: What happens when [scenario]?
   - Expected behavior: [description]

## Error Handling

| Error Condition | Error Type | User Message |
|-----------------|------------|--------------|
| [condition] | [ErrorType] | [message] |

## Testing Strategy

### Unit Tests

- [ ] Test [scenario 1]
- [ ] Test [scenario 2]
- [ ] Test edge case [scenario]

### Integration Tests

- [ ] Test [integration scenario]

### Manual Testing

1. Steps to manually verify the feature works

## Out of Scope

Things explicitly NOT included in this feature:
- [Item 1]
- [Item 2]

## Open Questions

- [ ] Question 1?
- [ ] Question 2?

## References

- Link to related specs
- Link to external documentation
- Link to design mockups
