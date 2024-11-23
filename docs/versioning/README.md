# Versioning

## Version Management

Our version management system consists of a Deno script (`scripts/version.ts`) that helps
you:

- List all current package versions
- Update versions of all packages simultaneously
- Update version of a specific package
- Follow semantic versioning practices

## Basic Usage

### List All Package Versions

To see the current versions of all packages in your monorepo:

```bash
deno task version
```

Output example:

```
@editor/core: 1.0.0
@renderer/core: 1.0.0
@common: 1.0.0
@playground: 1.0.0
...
```

### Update All Package Versions

To update all packages to a new version:

```bash
deno task version -- -v 1.2.0
```

This will:

1. Find all `deno.json` files in your monorepo
2. Update their version fields to `1.2.0`
3. Log each change made

Output example:

```
Updating @editor/core from 1.0.0 to 1.2.0
Updating @renderer/core from 1.0.0 to 1.2.0
Updating @common from 1.0.0 to 1.2.0
Updating @playground from 1.0.0 to 1.2.0
```

### Update a Specific Package

To update just one package to a new version:

```bash
deno task version -- -v 1.2.0 -p @editor/core
```

This will only update the specified package, leaving all others unchanged.

Output example:

```
Updating @editor/core from 1.0.0 to 1.2.0
```

## Command Line Options

| Option      | Alias | Description            | Example                  |
| ----------- | ----- | ---------------------- | ------------------------ |
| `--version` | `-v`  | New version to set     | `--version 1.2.0`        |
| `--package` | `-p`  | Package name to update | `--package @editor/core` |
| `--help`    | `-h`  | Show help message      | `--help`                 |

## Version Numbering Guide

We follow Semantic Versioning (SemVer) for version numbers:

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes (e.g., 2.0.0)
- **MINOR**: New features, backward compatible (e.g., 1.1.0)
- **PATCH**: Bug fixes, backward compatible (e.g., 1.0.1)

### When to Update Versions

1. **PATCH** update (e.g., 1.0.0 → 1.0.1):

   - Bug fixes
   - Performance improvements
   - Documentation updates

2. **MINOR** update (e.g., 1.0.0 → 1.1.0):

   - New features
   - New non-breaking functionality
   - Marking features as deprecated

3. **MAJOR** update (e.g., 1.0.0 → 2.0.0):
   - Breaking API changes
   - Removing deprecated features
   - Major architectural changes

## Best Practices

### Release Workflow

1. **Make Changes**

   ```bash
   git checkout -b feature/new-feature
   # Make your changes
   ```

2. **Test Changes**

   ```bash
   deno task test
   ```

3. **Update Version**

   ```bash
   # For all packages
   deno task version -- -v 1.2.0

   # Or for a specific package
   deno task version -- -v 1.2.0 -p @editor/core
   ```

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "chore: bump version to 1.2.0"
   ```

5. **Create Pull Request**
   - Submit your changes for review
   - Merge after approval

### Version Management Tips

1. **Keep a Changelog**: Document all notable changes for each version.

2. **Coordinate Dependencies**: When updating a package version, consider updating
   dependent packages that rely on the changed package.

3. **Version Consistency**: Consider keeping all packages at the same version for easier
   maintenance, unless there's a specific reason not to.

4. **Git Tags**: Create git tags for significant releases:
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

## Additional Resources

- [Semantic Versioning Specification](https://semver.org/)
- [Deno Workspace Documentation](https://docs.deno.com/runtime/fundamentals/workspaces/)
