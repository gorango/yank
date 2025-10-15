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

# Interactively select files to yank
yank --preview
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
| `--lang-map` | | JSON string of language overrides (e.g., `'{"LICENSE":"text"}'`), with values validated against supported languages. | `{}` |
| `--max-size` | | Maximum file size in bytes to process. Files larger than this are skipped. | `0` (no limit) |
| `--debug` | | Enable verbose debug logging. | `false` |
| `--preview` | `-p` | Enable interactive preview mode to select files before processing. | `false` |
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

## Configuration Schema

The configuration file must adhere to the following schema. Invalid types will cause `yank` to throw an error.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `clip` | `boolean` | Send output to the system clipboard instead of `stdout`. | `true` |
| `include` | `array` of `string` | Glob patterns for files to include. | `["src/**/*.ts", "README.md"]` |
| `exclude` | `array` of `string` | Glob patterns to exclude. | `["**/*.test.ts"]` |
| `fileTemplate` | `string` | Template for the file header. Must include `{filePath}`. | `"## {filePath}"` |
| `codeTemplate` | `string` | Template for the code block. Must include `{content}`. | `"```{language}\n{content}\n```"` |
| `stats` | `boolean` | Print summary statistics to `stderr`. | `true` |
| `tokens` | `boolean` | Print number of tokens in `stats`. | `false` |
| `debug` | `boolean` | Enable verbose debug logging. | `false` |
| `languageOverrides` | `object` | JSON object of language overrides. | `{"LICENSE": "text"}` |
| `maxSize` | `number` | Maximum file size in bytes to process (0 for no limit). | `1048576` |

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
- `#!/usr/bin/env deno` → `typescript`
- `#!/usr/bin/env bun` → `javascript`
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

## Token Counting

`yank` supports estimating the number of tokens in the output using a lightweight heuristic. This is particularly useful for AI applications where you need to estimate costs or ensure content fits within model limits.

### Usage

Enable token counting with the `--tokens` flag or by setting `tokens: true` in your configuration file. When enabled, the token count is included in the stats output.

```sh
# Count tokens in the output
yank --tokens

# In yank.toml
tokens = true
```

### Implementation Details

- Uses a lightweight heuristic-based approach that provides estimates within 10-20% of actual token counts.
- Works across different AI models, not tied to any specific tokenizer like OpenAI's `cl100k_base`.
- Token count is calculated on the final formatted output, including headers and code blocks.
- Pure JavaScript/TypeScript implementation with no external dependencies.

### AI Use Cases

- **Cost Estimation**: Calculate approximate API costs before sending to AI models.
- **Context Window Management**: Ensure output fits within model token limits.
- **Debugging**: Verify that large codebases don't exceed expected token counts.

### Accuracy Notes

Token counts are approximate and may vary by model (typically within 10-20% deviation from actual tokenizers). The heuristic works by:
- Splitting text into words and punctuation
- Applying length-based scaling for subword tokenization
- Counting special characters and newlines as individual tokens

For exact token counts, use model-specific tokenizers directly.

## Binary File Exclusion

`yank` automatically excludes binary files to prevent corruption of the output and improve performance. Binary files are identified by their file extensions and are not processed or included in the output.

### Excluded Extensions

The following extensions are treated as binary and excluded by default:

**Archives & Compressed**: `7z`, `a`, `apk`, `ar`, `bz2`, `cab`, `cpio`, `deb`, `dmg`, `gz`, `iso`, `jar`, `lz`, `lz4`, `lzma`, `nupkg`, `rar`, `rpm`, `tar`, `taz`, `tbz`, `tbz2`, `tgz`, `tlz`, `txz`, `xz`, `z`, `zip`, `zst`

**Images**: `ai`, `bmp`, `gif`, `heic`, `ico`, `icns`, `jpeg`, `jpg`, `png`, `psd`, `svgz`, `tif`, `tiff`, `webp`

**Video**: `avi`, `flv`, `m4v`, `mkv`, `mov`, `mp4`, `mpeg`, `mpg`, `webm`, `wmv`

**Audio**: `aac`, `aiff`, `flac`, `m4a`, `mp3`, `ogg`, `opus`, `wav`, `wma`

**Documents**: `doc`, `docx`, `dotx`, `epub`, `mobi`, `odt`, `pdf`, `ppt`, `pptx`, `rtf`, `xls`, `xlsx`

**Other**: `bin`, `class`, `core`, `dat`, `db`, `dll`, `dylib`, `eot`, `exe`, `lock`, `o`, `obj`, `pak`, `pdb`, `so`, `swp`, `swo`, `ttf`, `woff`, `woff2`

### Rationale

- **Output Integrity**: Binary files can contain non-text data that corrupts the formatted output.
- **Performance**: Skipping large binary files speeds up processing.
- **Relevance**: Typically, users want to yank source code, not binary assets.

### Customization

You can override this behavior by using include patterns that explicitly match binary files, but they will still be processed as text if readable.

## Symlink Handling

`yank` does not follow symbolic links (due to `followSymbolicLinks: false` in file discovery). If symlinks are needed, use explicit include patterns. Use `--debug` to diagnose symlink-related issues.

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

### Common Issues

**No files matched:**
- Verify that your include patterns are correct and that the files exist in the specified directories.
- Check if `.gitignore` rules are excluding the files you expect to include.
- Use `--debug` to see detailed information about file discovery.

**Unexpected file exclusions:**
- Check parent directory `.gitignore` files for rules that might affect the file.
- Verify that negation patterns (`!pattern`) are correctly placed in subdirectory `.gitignore` files.
- Ensure that the file is not being excluded by default patterns (e.g., `node_modules/**`).

**Unexpected file inclusions:**
- Ensure that `.gitignore` files with negation rules are in the correct directories.
- Check for conflicting rules in nested `.gitignore` files.
- Review your include and exclude patterns for overlaps.

**Permission denied:**
- Some files may be inaccessible due to file permissions. Use `--debug` to see which files are being skipped and why.
- Run `yank` with appropriate permissions or as a different user if necessary.

**Invalid glob pattern:**
- Check for syntax errors in your include/exclude patterns, such as unclosed brackets `[]`, braces `{}`, or parentheses `()`.
- `yank` validates patterns and will exit with an error if they are malformed.

 **Skipped files:**
 - Files that cannot be read (e.g., due to permissions or being binary) are skipped.
 - When `--stats` is enabled, skipped files are counted and reasons are reported in the output.
 - Use `--stats` to view skipped file counts and reasons, even without `--debug`, for quick diagnostics.
 - Use `--debug` for detailed error messages about skipped files.

**Performance with many `.gitignore` files:**
- `yank` efficiently processes `.gitignore` hierarchies.
- Deeply nested structures (5+ levels) are fully supported.
- Invalid `.gitignore` syntax is handled gracefully without breaking the process.

**Token counting issues:**
- Token counts are approximate estimates using a lightweight heuristic.
- For more accurate counts, use model-specific tokenizers directly.
- The heuristic provides estimates within 10-20% of actual token counts for most use cases.

**Language detection problems:**
- For files without extensions, ensure shebang lines are present and correctly formatted.
- Use `--lang-map` to override automatic detection for specific files.
- Check that the file extension is supported (see Language Detection section).

### Error Handling and Debugging

**File reading errors:**
- Files that cannot be read (e.g., permission denied) are silently skipped in normal mode.
- Use `--debug` flag to see detailed error messages for failed file reads.
- When `--stats` is enabled, skipped files are counted and reasons are reported.

**Glob pattern validation:**
- Invalid glob patterns will cause `yank` to exit with an error.
- Common issues include unclosed character classes or brace expansions.

**Debug mode:**
- Use `--debug` flag to enable verbose logging.
- Shows detailed information about file discovery, ignore rule processing, and error details.
- Includes stack traces for errors when available.

**Getting help:**
- Run `yank --help` for a list of all options.
- Check the configuration schema for valid settings.
- Report issues at https://github.com/sst/opencode/issues if problems persist.
