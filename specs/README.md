# Shadr Specifications

This directory contains specifications for the shadr project. Specifications serve as the "source of truth" for AI agents working on the project.

## Purpose

Specifications allow you to:
1. **Define requirements clearly** before implementation
2. **Guide AI agents** to build the right thing
3. **Maintain consistency** across multiple development sessions
4. **Document decisions** for future reference

## Directory Structure

```
specs/
├── README.md           # This file
├── architecture.md     # High-level architecture overview
├── features/           # Feature specifications
│   └── TEMPLATE.md     # Template for new features
└── stdlib/             # Standard library specs (if applicable)
```

## How to Create Specifications

### 1. Start with a Conversation

Before creating a spec, have a conversation with the AI about your requirements:
- What problem are you solving?
- What are the constraints?
- What are the edge cases?
- What patterns should be followed?

### 2. Generate the Spec

Once the AI understands, ask it to write the specification:
```
Write a specification for [feature] based on our discussion.
Save it to specs/features/[feature-name].md
```

### 3. Review and Iterate

Specifications are living documents. Update them when:
- Requirements change
- You discover edge cases
- Implementation reveals issues

## Specification Template

Each spec should include:
1. **Overview**: What is this feature?
2. **Requirements**: What must it do?
3. **API/Interface**: How will it be used?
4. **Implementation Notes**: Technical considerations
5. **Edge Cases**: What could go wrong?
6. **Testing Strategy**: How to verify it works?

## Using Specs with Ralph Wiggum

The Ralph prompts reference `@specs/*` to understand what to build. When you add or update specs, Ralph will use them in subsequent iterations.

Example prompt that uses specs:
```markdown
Study @specs/features/shader-editor.md to understand the requirements.
Implement the shader editor according to the specification.
```

## Tips

- **Be specific**: Vague specs lead to vague implementations
- **Include examples**: Show expected inputs and outputs
- **Define boundaries**: What is NOT in scope?
- **Link to context**: Reference existing code patterns
