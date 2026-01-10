## v1.3.2 - 2026-01-10
- Renamed lib.ts and lib.test.ts to output.ts and output.test.ts for better code organization
- Added font file extensions section with all variants (eot, otf, ttc, ttf, woff, woff2)

## v1.3.4 - 2025-12-14
- Properly exclude binary files using individual extension patterns instead of brace expansion
- Added --workspace flag for yanking JS monorepo packages and their dependencies
- Made workspace recursion optional with --workspace-recursive flag and fixed scoping issues

## v1.3.3 - 2025-12-14
- Improved test coverage with enhanced mocking and additional test cases
- Upgraded major dependencies

## v1.3.2 - 2025-11-05
- Enhanced clipboard validation to detect write failures
- Fixed version printing issues

## v1.3.1 - 2025-11-03
- Fixed directory exclusion with .gitignore files in subdirectories

## v1.3.0 - 2025-10-28
- Ensured stats and token counts are always displayed
- Fixed prompt test in CI

## v1.2.2 - 2025-10-20
- Fixed nested .gitignore handling for proper rule inheritance
- Added test coverage

## v1.2.1 - 2025-10-15
- Replaced ESLint with Biome for improved linting
- Switched to lightweight heuristic token estimator from Tiktoken
- Added `--preview` mode for interactive file selection
- Enhanced config validation, language detection, error handling, and debugging
- Added typecheck script and updated documentation

## v1.2.0 - 2025-10-14
- Implemented hierarchical .gitignore support for accurate nested file filtering
- Improved code semantics and fixed markdown template issues

## v1.1.0 - 2025-10-14
- Unified input path handling for include patterns with directory expansion
- Added token count and lines of code to stats output
- Introduced custom config flag for specifying config file path
- Updated installation instructions, linting, and default code fences

## v1.0.0 - 2025-10-07
- Initial release
