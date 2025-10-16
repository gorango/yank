# `yank` - grab and format code

[![NPM Version](https://img.shields.io/npm/v/yank-cli.svg)](https://www.npmjs.com/package/yank-cli)
[![Codecov](https://img.shields.io/codecov/c/github/gorango/yank/master)](https://codecov.io/github/gorango/yank)

`yank` is a fast and friendly CLI to collect, format, and copy source code from your projects.

## Get Started

Install `yank` globally using npm:

```sh
npm install -g yank-cli
```

## How to Use `yank`

### Basic Commands

Quickly grab code from files or directories and either print it to your terminal or copy your clipboard.

```sh
# Copy a directory's code to your clipboard
yank src --clip # or -c

# View files in a pager (like less)
yank config *.json | less

# Pick files interactively
yank --preview # or -p
```

Run `yank` without specifying path to all files in your project, skipping anything listed in `.gitignore`.

```sh
# Grab the entire project
yank
```

## Options

Customize how `yank` works with these options:

| Option | Shortcut | What it Does | Default |
|--------|----------|--------------|---------|
| `--clip` | `-c` | Copies output to your clipboard instead of printing it. | Off |
| `--include` | `-i` | Specify file patterns to include (e.g., `src/*.ts`). Ignored if you list paths directly. | All files (`**/*`) |
| `--exclude` | `-x` | Skip specific file patterns (adds to defaults like `node_modules`). | None |
| `--name-template` | `-H` | Customize the header for each file. | `--- {filePath} ---` |
| `--code-template` | `-B` | Set the format for code blocks. | <code>```{language}<br>{content}<br>```</code> |
| `--stats` | `-s` | Show summary stats (e.g., file count) in the terminal. | Off |
| `--tokens` | `-t` | Include token count in stats (great for AI workflows). | Off |
| `--config` | `-C` | Use a custom config file. | Auto-detected |
| `--lang-map` | | Override file language detection (e.g., `'{"LICENSE":"text"}'`). | None |
| `--max-size` | | Skip files larger than this size (in bytes). | No limit (`0`) |
| `--debug` | | Show detailed logs for troubleshooting. | Off |
| `--preview` | `-p` | Interactively select files before processing. | Off |
| `--help` | `-h` | Display help info. | |
| `--version` | `-v` | Show the version number. | |

## Set Up a Config File

Customize `yank` by adding a config file to your project. It automatically finds files like `yank.toml`, `yank.yaml`, `yank.json`, `yank.config.js`, or a `yank` section in `package.json`. You can add any number of custom configs to more easily select different parts of your codebase using the `--config|-c` flag.

### Example `yank.toml`

````toml
# Always copy to clipboard
clip = true

# Show stats
stats = true

# Only include these files
include = ["src/**/*.ts", "README.md", "package.json"]

# Skip test files
exclude = ["**/*.spec.ts", "**/*.test.ts"]

# Custom formatting
fileTemplate = "## {filePath}"
codeTemplate = """
```
{content}
```
"""

# Treat LICENSE as plain text
languageOverrides = { LICENSE = "text" }
````

### Config Options

Your config file can include these settings:

| Field | Type | What it Does | Example |
|-------|------|--------------|---------|
| `clip` | Boolean | Copy output to clipboard instead of printing. | `true` |
| `include` | Array of strings | File patterns to include. | `["src/**/*.ts", "README.md"]` |
| `exclude` | Array of strings | File patterns to skip. | `["**/*.test.ts"]` |
| `fileTemplate` | String | File header format (must include `{filePath}`). | `"## {filePath}"` |
| `codeTemplate` | String | Code block format (must include `{content}`). | <code>"```{language}\n{content}\n```"</code> |
| `stats` | Boolean | Show summary stats. | `true` |
| `tokens` | Boolean | Include token count in stats. | `false` |
| `debug` | Boolean | Enable detailed logs. | `false` |
| `languageOverrides` | Object | Override language detection for files. | `{"LICENSE": "text"}` |
| `maxSize` | Number | Skip files larger than this (in bytes, 0 = no limit). | `1048576` (1MB) |

## How `yank` Detects Languages

`yank` automatically figures out the programming language for syntax highlighting based on:

1. **File Extensions**: Recognizes `.js`, `.py`, `.ts`, etc.
2. **File Names**: Knows special files like `Dockerfile` or `Makefile`.
3. **Shebang Lines**: Checks the first line for things like `#!/bin/bash`.

### Supported File Types

- **Web**: `.js`, `.ts`, `.html`, `.css`, `.json`, `.md`, `.yaml`, etc.
- **Backend**: `.py`, `.go`, `.java`, `.php`, `.cs`, `.cpp`, etc.
- **Shell/Config**: `.sh`, `.bash`, `.dockerfile`, `.tf`, etc.
- **Data**: `.sql`, `.graphql`
- **Other**: `.r`, `.dart`, `.hs`, `.clj`, etc.

### Override Language Detection

If `yank` gets the language wrong, you can override it:

```sh
# On the command line
yank --lang-map '{"LICENSE":"text","Makefile":"makefile"}'
```

```toml
# In yank.toml
languageOverrides = { LICENSE = "text", Makefile = "makefile" }
```

## Counting Tokens for AI

Need to know how many tokens your code will use in an AI model? Use the `--tokens` flag or set `tokens: true` in your config file.

```sh
yank --tokens # or -t
```

This gives an approximate token count (within 10-20% accuracy) for the formatted output, helping you estimate costs or fit within model limits.

## Skipping Binary Files

`yank` automatically skips binary files (like `.jpg`, `.zip`, `.pdf`) to keep your output clean and fast. You can override this with specific include patterns, but they’ll be treated as text if readable.

## Handling `.gitignore`

`yank` respects `.gitignore` files in your project, including nested ones. For example:

```gitignore
# Root .gitignore
*.log

# src/.gitignore
!*.log  # Re-include logs in src/
```

- `root.log` is skipped.
- `src/server.log` is included because of the negation (`!`).

## Troubleshooting Tips

- **No files found?** Check your include patterns or `.gitignore` rules. Use `--debug` for details.
- **Wrong files skipped?** Look at parent `.gitignore` files or use `--debug` to trace exclusions.
- **Permission issues?** Run with appropriate permissions or check `--debug` logs.
- **Bad glob patterns?** Fix syntax errors like unclosed `[]` or `{}`.
- **Need help?** Run `yank --help`.
