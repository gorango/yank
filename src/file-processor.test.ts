import type fsType from 'node:fs'
import fs from 'node:fs/promises'
import process from 'node:process'
import fg from 'fast-glob'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YankConfig } from './config'
import { processFiles } from './file-processor'

vi.mock('node:fs/promises')
vi.mock('fast-glob')
vi.mock('node:process', async (importOriginal) => {
	const originalProcess = await importOriginal<typeof import('node:process')>()
	return {
		...originalProcess,
		default: {
			// @ts-expect-error stfu
			...originalProcess.default,
			cwd: vi.fn(),
		},
	}
})

const virtualFs = new Map<string, string>()
const MOCK_CWD = '/Users/test/project'

beforeEach(() => {
	vi.resetAllMocks()
	virtualFs.clear()
	vi.mocked(process.cwd).mockReturnValue(MOCK_CWD)
	vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
		const resolvedPath = filePath.toString()
		if (virtualFs.has(resolvedPath)) return virtualFs.get(resolvedPath) as string
		throw new Error(`ENOENT: no such file or directory, open '${resolvedPath}'`)
	})
	vi.mocked(fs.stat).mockImplementation(async (filePath) => {
		const resolvedPath = filePath.toString()
		if (virtualFs.has(resolvedPath)) {
			return { isSymbolicLink: () => false } as fsType.Stats
		}
		throw new Error(`ENOENT: no such file or directory, stat '${resolvedPath}'`)
	})
})

describe('processFiles', () => {
	const mockConfig = {
		clip: false,
		include: ['**/*'],
		exclude: ['node_modules/**'],
		fileTemplate: '--- {filePath} ---',
		codeTemplate: '```{language}\n{content}\n```',
		stats: true,
		tokens: true,
		debug: false,
		preview: false,
		langMap: {},
	} as YankConfig

	it('should find, read, filter, and count lines correctly', async () => {
		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;\nconst y = 2;')
		virtualFs.set(`${MOCK_CWD}/package.json`, '{ "name": "test" }')
		virtualFs.set(`${MOCK_CWD}/node_modules/dep/index.js`, 'module.exports = {};')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) return []

			return [`${MOCK_CWD}/src/main.ts`, `${MOCK_CWD}/package.json`, `${MOCK_CWD}/node_modules/dep/index.js`]
		})

		const result = await processFiles(mockConfig)

		expect(result.files).toHaveLength(2)

		expect(result.files[0].relPath).toBe('package.json')
		expect(result.files[0].lineCount).toBe(1)

		expect(result.files[1].relPath).toBe('src/main.ts')
		expect(result.files[1].lineCount).toBe(2)

		expect(result.stats.totalFiles).toBe(2)
		expect(result.stats.processedFiles).toBe(2)
		expect(result.stats.skippedFiles).toBe(0)
	})

	it('should respect .gitignore rules', async () => {
		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;')
		virtualFs.set(`${MOCK_CWD}/dist/bundle.js`, '/* minified code */')
		virtualFs.set(`${MOCK_CWD}/.gitignore`, 'dist/\n*.log')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) return [`${MOCK_CWD}/.gitignore`]

			return [`${MOCK_CWD}/src/main.ts`, `${MOCK_CWD}/dist/bundle.js`]
		})

		const result = await processFiles(mockConfig)

		expect(result.files).toHaveLength(1)
		expect(result.files[0].relPath).toBe('src/main.ts')

		expect(result.stats.totalFiles).toBe(1)
		expect(result.stats.processedFiles).toBe(1)
		expect(result.stats.skippedFiles).toBe(0)
	})
})

describe('processFiles with nested .gitignore', () => {
	const mockConfig = {
		clip: false,
		include: ['**/*'],
		exclude: [],
		fileTemplate: '--- {filePath} ---',
		codeTemplate: '```{language}\n{content}\n```',
		stats: true,
		tokens: true,
		debug: false,
		workspaceRecursive: false,
		preview: false,
		langMap: {},
	} as YankConfig

	it('should handle multiple nested .gitignore files with conflicting negations', async () => {
		// Root ignores all logs
		virtualFs.set(`${MOCK_CWD}/.gitignore`, '*.log')
		virtualFs.set(`${MOCK_CWD}/root.log`, 'root log content')

		// Src un-ignores logs
		virtualFs.set(`${MOCK_CWD}/src/.gitignore`, '!*.log')
		virtualFs.set(`${MOCK_CWD}/src/server.log`, 'server log content')

		// Src/subdir re-ignores logs
		virtualFs.set(`${MOCK_CWD}/src/subdir/.gitignore`, '*.log')
		virtualFs.set(`${MOCK_CWD}/src/subdir/app.log`, 'app log content')

		// Src/subdir/nested un-ignores logs again
		virtualFs.set(`${MOCK_CWD}/src/subdir/nested/.gitignore`, '!*.log')
		virtualFs.set(`${MOCK_CWD}/src/subdir/nested/debug.log`, 'debug log content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [
					`${MOCK_CWD}/.gitignore`,
					`${MOCK_CWD}/src/.gitignore`,
					`${MOCK_CWD}/src/subdir/.gitignore`,
					`${MOCK_CWD}/src/subdir/nested/.gitignore`,
				]
			}
			return [
				`${MOCK_CWD}/root.log`,
				`${MOCK_CWD}/src/server.log`,
				`${MOCK_CWD}/src/subdir/app.log`,
				`${MOCK_CWD}/src/subdir/nested/debug.log`,
				`${MOCK_CWD}/.gitignore`,
				`${MOCK_CWD}/src/.gitignore`,
				`${MOCK_CWD}/src/subdir/.gitignore`,
				`${MOCK_CWD}/src/subdir/nested/.gitignore`,
			]
		})

		const result = await processFiles(mockConfig)
		const paths = result.files.map((p) => p.relPath).sort()

		// Should include: root.log (ignored), src/server.log (un-ignored), src/subdir/app.log (re-ignored), src/subdir/nested/debug.log (un-ignored again)
		// All .gitignore files are included due to self-exclusion handling
		expect(paths).toEqual([
			'.gitignore',
			'src/.gitignore',
			'src/server.log',
			'src/subdir/.gitignore',
			'src/subdir/nested/.gitignore',
			'src/subdir/nested/debug.log',
		])

		expect(result.stats.totalFiles).toBe(6)
		expect(result.stats.processedFiles).toBe(6)
		expect(result.stats.skippedFiles).toBe(0)
	})

	it('should handle empty .gitignore files and invalid syntax gracefully', async () => {
		// Empty .gitignore files don't affect inclusion/exclusion
		virtualFs.set(`${MOCK_CWD}/.gitignore`, '')
		virtualFs.set(`${MOCK_CWD}/src/.gitignore`, '# This is a comment only')
		virtualFs.set(`${MOCK_CWD}/src/invalid.gitignore`, 'invalid syntax [unclosed bracket')
		virtualFs.set(`${MOCK_CWD}/test.txt`, 'content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [`${MOCK_CWD}/.gitignore`, `${MOCK_CWD}/src/.gitignore`, `${MOCK_CWD}/src/invalid.gitignore`]
			}
			return [`${MOCK_CWD}/test.txt`]
		})

		const result = await processFiles(mockConfig)
		const paths = result.files.map((p) => p.relPath).sort()

		// Empty .gitignore files are excluded by default (no self-exclusion for empty files)
		// Only the test.txt file should be included
		expect(paths).toEqual(['test.txt'])

		expect(result.stats.totalFiles).toBe(1)
		expect(result.stats.processedFiles).toBe(1)
		expect(result.stats.skippedFiles).toBe(0)
	})

	it('should handle deeply nested .gitignore files (5+ levels)', async () => {
		const deepPath = 'level1/level2/level3/level4/level5'
		const deepGitignore = `${MOCK_CWD}/${deepPath}/.gitignore`

		// The root .gitignore ignores the *contents* of any temp/ directory.
		// This does NOT ignore the directory itself, allowing nested rules to apply.
		virtualFs.set(`${MOCK_CWD}/.gitignore`, 'temp/*')

		// The deep .gitignore negates the rule for a specific file within its local temp/ directory.
		virtualFs.set(deepGitignore, '!temp/nested.txt')

		// This file should be ignored by the root rule.
		virtualFs.set(`${MOCK_CWD}/temp/file.txt`, 'content')

		// This file should be re-included by the deep rule.
		virtualFs.set(`${MOCK_CWD}/${deepPath}/temp/nested.txt`, 'nested content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [`${MOCK_CWD}/.gitignore`, deepGitignore]
			}
			return [
				`${MOCK_CWD}/temp/file.txt`,
				`${MOCK_CWD}/${deepPath}/temp/nested.txt`,
				`${MOCK_CWD}/.gitignore`,
				deepGitignore,
			]
		})

		const result = await processFiles(mockConfig)
		const paths = result.files.map((p) => p.relPath).sort()

		// The root .gitignore excludes contents of temp/, so temp/file.txt is excluded.
		// The deep negation overrides this for the specific nested file.
		expect(paths).toEqual(['.gitignore', `${deepPath}/.gitignore`, `${deepPath}/temp/nested.txt`])

		expect(result.stats.totalFiles).toBe(3)
		expect(result.stats.processedFiles).toBe(3)
		expect(result.stats.skippedFiles).toBe(0)
	})

	it('should handle .gitignore files that exclude themselves', async () => {
		// .gitignore that excludes itself
		virtualFs.set(`${MOCK_CWD}/.gitignore`, '.gitignore')
		virtualFs.set(`${MOCK_CWD}/src/.gitignore`, '.gitignore')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [`${MOCK_CWD}/.gitignore`, `${MOCK_CWD}/src/.gitignore`]
			}
			return [`${MOCK_CWD}/.gitignore`, `${MOCK_CWD}/src/.gitignore`]
		})

		const result = await processFiles(mockConfig)
		const paths = result.files.map((p) => p.relPath).sort()

		// .gitignore files that exclude themselves are excluded (no self-exclusion handling for explicit exclusions)
		expect(paths).toEqual([])

		expect(result.stats.totalFiles).toBe(0)
		expect(result.stats.processedFiles).toBe(0)
		expect(result.stats.skippedFiles).toBe(0)
	})

	it('should handle file read errors and collect stats', async () => {
		// Set up files that will fail to read
		vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
			const resolvedPath = filePath.toString()
			if (resolvedPath.includes('fail')) {
				throw new Error('Permission denied')
			}
			if (virtualFs.has(resolvedPath)) return virtualFs.get(resolvedPath) as string
			throw new Error(`ENOENT: no such file or directory, open '${resolvedPath}'`)
		})

		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;')
		virtualFs.set(`${MOCK_CWD}/src/fail.txt`, 'should fail')

		vi.mocked(fg).mockImplementation(async (_patterns) => {
			return [`${MOCK_CWD}/src/main.ts`, `${MOCK_CWD}/src/fail.txt`]
		})

		const result = await processFiles(mockConfig)

		expect(result.files).toHaveLength(1)
		expect(result.files[0].relPath).toBe('src/main.ts')

		expect(result.stats.totalFiles).toBe(2)
		expect(result.stats.processedFiles).toBe(1)
		expect(result.stats.skippedFiles).toBe(1)
		expect(result.stats.skippedReasons.get('Permission denied')).toBe(1)
	})

	it('should log file read errors in debug mode', async () => {
		const debugConfig = { ...mockConfig, debug: true } as YankConfig

		vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
			const resolvedPath = filePath.toString()
			if (resolvedPath.includes('fail')) {
				throw new Error('Permission denied')
			}
			if (virtualFs.has(resolvedPath)) return virtualFs.get(resolvedPath) as string
			throw new Error(`ENOENT: no such file or directory, open '${resolvedPath}'`)
		})

		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;')
		virtualFs.set(`${MOCK_CWD}/src/fail.txt`, 'should fail')

		vi.mocked(fg).mockImplementation(async (_patterns) => {
			return [`${MOCK_CWD}/src/main.ts`, `${MOCK_CWD}/src/fail.txt`]
		})

		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

		await processFiles(debugConfig)

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read src/fail.txt: Permission denied'))

		consoleSpy.mockRestore()
	})

	it('should handle symlinks correctly', async () => {
		virtualFs.set(`${MOCK_CWD}/regular-file.txt`, 'content')
		virtualFs.set(`${MOCK_CWD}/symlink.txt`, 'symlink content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) return []
			return [`${MOCK_CWD}/regular-file.txt`, `${MOCK_CWD}/symlink.txt`]
		})

		const result = await processFiles(mockConfig)
		expect(result.files).toHaveLength(2)
		expect(result.files.map((f) => f.relPath)).toEqual(['regular-file.txt', 'symlink.txt'])
	})

	it('should exclude directories even when they contain .gitignore files', async () => {
		const configWithExclude = {
			...mockConfig,
			exclude: ['excluded/'],
		}

		// Set up files in excluded directory
		virtualFs.set(`${MOCK_CWD}/included.txt`, 'included content')
		virtualFs.set(`${MOCK_CWD}/excluded/file.txt`, 'excluded content')
		virtualFs.set(`${MOCK_CWD}/excluded/.gitignore`, '*.txt') // This would normally exclude .txt files

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [`${MOCK_CWD}/excluded/.gitignore`]
			}
			return [`${MOCK_CWD}/included.txt`, `${MOCK_CWD}/excluded/file.txt`, `${MOCK_CWD}/excluded/.gitignore`]
		})

		const result = await processFiles(configWithExclude)
		const paths = result.files.map((f) => f.relPath).sort()

		// Should include included.txt but exclude everything in excluded/ directory,
		// even though .gitignore in excluded/ has patterns
		expect(paths).toEqual(['included.txt'])
	})
})
