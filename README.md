# `yank`

A fast, simple CLI to grab, format, and copy source code.

## Installation

```sh
npm install -g yank-cli
```

## Usage

#### Basic Usage

You can pass file and directory paths directly to `yank`. By default, it prints the formatted result to `stdout`, which is perfect for piping.

```sh
# Yank a specific directory to your clipboard
yank src --clip

# View multiple files and directories in a pager
yank config *.json | less
```

If you don't provide any paths, `yank` will grab all files in the current project (respecting `.gitignore`).

```sh
# Yank the entire project to stdout
yank
```

## Options

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `--clip` | `-c` | Send output to the system clipboard instead of `stdout`. | `false` |
| `--include` | `-i` | Glob patterns for files to include. **Ignored if paths are provided directly.** | `**/*` |
| `--exclude` | `-x` | Glob patterns to exclude. Appended to built-in defaults. | `[]` |
| `--name-template` | `-H` | Template for the file header. | `--- {filePath} ---` |
| `--code-template` | `-B` | Template for the code block. | ` ```{language}\n{content}\n``` ` |
| `--stats` | `-s` | Print summary statistics to `stderr`. | `false` |
| `--tokens` | `-t` | Print number of tokens in `stats`. | `false` |
| `--config` | `-C` | Path to a custom configuration file. | |
| `--lang-map` | | JSON string of language overrides (e.g., `'{"LICENSE":"text"}'`). | `{}` |
| `--debug` | | Enable verbose debug logging. | `false` |
| `--help` | `-h` | Show the help message. | |
| `--version` | `-v` | Show the version number. | |

## Config File

For project-specific defaults, create a configuration file. `yank` will automatically find and use it.

**Supported files:** `yank.toml`, `yank.yaml`, `yank.json`, `yank.config.js`, or a `yank` property in `package.json`.

#### Example `yank.toml`

````toml
# Always send output to clipboard for this project
clip = true

# Always show stats
stats = true

# Project-specific files to grab
include = [
  "src/**/*.ts",
  "README.md",
  "package.json"
]

# Add extra patterns to the default exclude list
exclude = [
  "**/*.spec.ts",
  "**/*.test.ts"
]

# Customize formatting for this project
fileTemplate = "## {filePath}"
codeTemplate = """
```
{content}
```
"""

# Override language detection for specific files
languageOverrides = { LICENSE = "text" }
````

## Language Detection

`yank` automatically detects the programming language of files for syntax highlighting in code blocks. It uses multiple strategies to determine the correct language:

### Automatic Detection

1. **File Extensions**: Maps common extensions (`.ts`, `.js`, `.py`, etc.) to their corresponding languages
2. **Special Filenames**: Recognizes files like `Dockerfile`, `Makefile`, `Jenkinsfile` by name
3. **Shebang Detection**: For files without extensions, reads the first line to detect interpreter directives

### Supported Extensions

The following extensions are automatically recognized:

**Web Technologies**: `ts`, `tsx`, `js`, `jsx`, `html`, `css`, `scss`, `less`, `json`, `md`, `mdx`, `yaml`, `yml`, `toml`, `xml`, `svg`, `svelte`, `vue`

**Backend & Systems**: `py`, `rb`, `go`, `rs`, `php`, `java`, `kt`, `kts`, `cs`, `fs`, `cpp`, `c`, `h`, `hpp`, `lua`, `pl`, `swift`, `scala`, `ex`, `exs`, `cr`

**Shell & Config**: `sh`, `bash`, `zsh`, `fish`, `ps1`, `dockerfile`, `tf`, `hcl`, `nginx`, `conf`, `ini`

**SQL & Data**: `sql`, `graphql`, `gql`

**Other**: `r`, `dart`, `hs`, `erl`, `clj`, `elm`

### Shebang Detection

For files without extensions, `yank` inspects the first line for shebang patterns:

- `#!/bin/bash` → `bash`
- `#!/usr/bin/env python3` → `python`
- `#!/usr/bin/node` → `javascript`
- `#!/usr/bin/env ruby` → `ruby`
- And more...

### Language Mapping

You can override automatic detection using the `--lang-map` option or in your config file:

```sh
# Command line usage
yank --lang-map '{"LICENSE":"text","Makefile":"makefile"}'
```

```toml
# In yank.toml
languageOverrides = { LICENSE = "text", Makefile = "makefile" }
```

```json
// In yank.json
{
  "languageOverrides": {
    "LICENSE": "text",
    "Makefile": "makefile"
  }
}
```

**Override Priority**: Filename matches take precedence over full path matches.

### Case-Insensitive Extensions

Extensions are handled case-insensitively (e.g., `.R` and `.r` both map to `r` language).

## Ignore Rules Handling

`yank` processes `.gitignore` files hierarchically to determine which files to include or exclude. This ensures that nested `.gitignore` rules are properly respected, including negations and self-exclusion behavior.

### Hierarchical Processing

`.gitignore` files are processed from the root directory down, with each directory's rules inheriting from its parent:

- Root `.gitignore` rules apply to the entire project
- Subdirectory `.gitignore` files can override parent rules for files in their directory
- Negation patterns (`!pattern`) can re-include files excluded by parent rules

### Negation Support

Negation patterns allow re-including files that would otherwise be excluded:

```gitignore
# Root .gitignore - exclude all log files
*.log

# src/.gitignore - re-include log files in src/
!*.log
```

In this example:
- `root.log` would be excluded
- `src/server.log` would be included (re-included by the negation rule)

### Self-Exclusion Behavior

`.gitignore` files have special handling for self-exclusion:

- If a `.gitignore` file contains `*` (matching everything), it will still be included in the output
- If a `.gitignore` file explicitly excludes itself (e.g., contains `.gitignore`), it will be excluded
- Empty `.gitignore` files or files with only comments are excluded by default

### Example Project Structure

```
project/
├── .gitignore          # Excludes *.log
├── root.log           # Excluded
├── src/
│   ├── .gitignore     # Contains !*.log
│   └── server.log     # Included (re-included by negation)
└── dist/
    ├── .gitignore     # Contains *
    └── bundle.js      # Excluded by * rule
```

In this structure:
- `root.log` is excluded by the root `.gitignore`
- `src/server.log` is included due to the negation rule in `src/.gitignore`
- `dist/bundle.js` is excluded by the `*` rule in `dist/.gitignore`
- All `.gitignore` files are included in the output

### Troubleshooting

**Unexpected file exclusions:**
- Check parent directory `.gitignore` files for rules that might affect the file
- Verify that negation patterns (`!pattern`) are correctly placed in subdirectory `.gitignore` files

**Unexpected file inclusions:**
- Ensure that `.gitignore` files with negation rules are in the correct directories
- Check for conflicting rules in nested `.gitignore` files

**Performance with many `.gitignore` files:**
- `yank` efficiently processes `.gitignore` hierarchies
- Deeply nested structures (5+ levels) are fully supported
- Invalid `.gitignore` syntax is handled gracefully without breaking the process

**Error Handling and Debugging:**

**File reading errors:**
- Files that cannot be read (e.g., permission denied) are silently skipped in normal mode
- Use `--debug` flag to see detailed error messages for failed file reads
- When `--stats` is enabled, skipped files are counted and reasons are reported

**Glob pattern validation:**
- Invalid glob patterns (unclosed brackets `[]`, braces `{}`, or parentheses `()`) will cause `yank` to exit with an error
- Check your include/exclude patterns for syntax errors

**Debug mode:**
- Use `--debug` flag to enable verbose logging
- Shows detailed information about file discovery, ignore rule processing, and error details
- Includes stack traces for errors when available

**Common issues:**
- **"No files matched"**: Check your include patterns and ensure files exist
- **"Permission denied"**: Some files may be inaccessible; use `--debug` to see which ones
- **"Invalid glob pattern"**: Check for syntax errors in your patterns
