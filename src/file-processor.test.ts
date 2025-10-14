import type { YankConfigCtor } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'

import fg from 'fast-glob'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
		if (virtualFs.has(resolvedPath))
			return virtualFs.get(resolvedPath)!
		throw new Error(`ENOENT: no such file or directory, open '${resolvedPath}'`)
	})
})

describe('processFiles', () => {
	const mockConfig: YankConfigCtor = {
		include: ['**/*'],
		exclude: ['node_modules/**'],
		debug: false,
		tokens: false,
	} as YankConfigCtor

	it('should find, read, filter, and count lines correctly', async () => {
		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;\nconst y = 2;')
		virtualFs.set(`${MOCK_CWD}/package.json`, '{ "name": "test" }')
		virtualFs.set(`${MOCK_CWD}/node_modules/dep/index.js`, 'module.exports = {};')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore'))
				return []

			return [
				`${MOCK_CWD}/src/main.ts`,
				`${MOCK_CWD}/package.json`,
				`${MOCK_CWD}/node_modules/dep/index.js`,
			]
		})

		const processed = await processFiles(mockConfig)

		expect(processed).toHaveLength(2)

		expect(processed[0].relPath).toBe('package.json')
		expect(processed[0].lineCount).toBe(1)

		expect(processed[1].relPath).toBe('src/main.ts')
		expect(processed[1].lineCount).toBe(2)
	})

	it('should respect .gitignore rules', async () => {
		virtualFs.set(`${MOCK_CWD}/src/main.ts`, 'const x = 1;')
		virtualFs.set(`${MOCK_CWD}/dist/bundle.js`, '/* minified code */')
		virtualFs.set(`${MOCK_CWD}/.gitignore`, 'dist/\n*.log')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore'))
				return [`${MOCK_CWD}/.gitignore`]

			return [
				`${MOCK_CWD}/src/main.ts`,
				`${MOCK_CWD}/dist/bundle.js`,
			]
		})

		const processed = await processFiles(mockConfig)

		expect(processed).toHaveLength(1)
		expect(processed[0].relPath).toBe('src/main.ts')
	})
})

describe('processFiles with nested .gitignore', () => {
	const mockConfig: YankConfigCtor = {
		include: ['**/*'],
		exclude: [],
		debug: false,
		tokens: false,
		clip: false,
		fileTemplate: '--- {filePath} ---',
		codeTemplate: '```{language}\n{content}\n```',
		stats: false,
	}

	it('should fail on original code because nested negation is not respected', async () => {
		// Root ignores all logs
		virtualFs.set(`${MOCK_CWD}/.gitignore`, '*.log')
		virtualFs.set(`${MOCK_CWD}/root.log`, 'content')

		// Src un-ignores logs
		virtualFs.set(`${MOCK_CWD}/src/.gitignore`, '!*.log')
		virtualFs.set(`${MOCK_CWD}/src/server.log`, 'content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore')) {
				return [`${MOCK_CWD}/.gitignore`, `${MOCK_CWD}/src/.gitignore`]
			}
			return [
				`${MOCK_CWD}/root.log`,
				`${MOCK_CWD}/src/server.log`,
				`${MOCK_CWD}/.gitignore`,
				`${MOCK_CWD}/src/.gitignore`,
			]
		})

		const processed = await processFiles(mockConfig)
		const paths = processed.map(p => p.relPath).sort()

		expect(paths).toEqual([
			'.gitignore',
			'src/.gitignore',
			'src/server.log',
		])
	})

	it('should fail on original code regarding .gitignore self-exclusion via wildcard', async () => {
		virtualFs.set(`${MOCK_CWD}/dist/.gitignore`, '*')
		virtualFs.set(`${MOCK_CWD}/dist/file.js`, 'content')

		vi.mocked(fg).mockImplementation(async (patterns) => {
			if (patterns.toString().includes('.gitignore'))
				return [`${MOCK_CWD}/dist/.gitignore`]
			return [`${MOCK_CWD}/dist/.gitignore`, `${MOCK_CWD}/dist/file.js`]
		})

		const processed = await processFiles(mockConfig)
		const paths = processed.map(p => p.relPath).sort()

		expect(paths).toEqual(['dist/.gitignore'])
	})
})
