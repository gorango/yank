import type fs from 'node:fs'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { YankConfig } from './config'

vi.mock('cosmiconfig')
vi.mock('node:fs/promises')

describe('YankConfig.init', () => {
	let argvSpy: ReturnType<typeof vi.spyOn>

	beforeEach(async () => {
		vi.resetAllMocks()

		const { cosmiconfig } = vi.mocked(await import('cosmiconfig'))
		cosmiconfig.mockReturnValue({
			search: vi.fn().mockResolvedValue(null),
			load: vi.fn(),
			clearLoadCache: vi.fn(),
			clearSearchCache: vi.fn(),
			clearCaches: vi.fn(),
		})

		const fsPromisesMock = vi.mocked(await import('node:fs/promises'))
		fsPromisesMock.readFile.mockResolvedValue(JSON.stringify({ version: '1.2.3' }))
		fsPromisesMock.stat.mockImplementation(async (p: fs.PathLike) => {
			const pathStr = p.toString()
			if (pathStr === 'src' || pathStr === 'docs/') {
				return { isDirectory: () => true } as fs.Stats
			}
			if (pathStr === 'README.md') {
				return { isDirectory: () => false } as fs.Stats
			}
			throw new Error('ENOENT')
		})

		argvSpy = vi.spyOn(process, 'argv', 'get')
	})

	afterEach(() => {
		argvSpy.mockRestore()
	})

	it('should convert a directory argument into a glob pattern', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'src'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*'])
	})

	it('should handle a directory argument with a trailing slash', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'docs/'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['docs/**/*'])
	})

	it('should keep a file argument as is', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'README.md'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['README.md'])
	})

	it('should keep a glob-like argument as is', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'lib/**/*.ts'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['lib/**/*.ts'])
	})

	it('should correctly process a mix of arguments', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'src', 'README.md', 'lib/**/*.ts'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*', 'README.md', 'lib/**/*.ts'])
	})

	it('should use the default include pattern when no arguments are provided', async () => {
		argvSpy.mockReturnValue(['node', 'yank'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['**/*'])
	})

	it('should prioritize positional arguments over the --include flag', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'src', '--include', 'lib/**'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*'])
	})
})
