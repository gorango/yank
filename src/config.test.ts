import type fs from 'node:fs'
import process from 'node:process'
import type { PublicExplorer } from 'cosmiconfig'
import fg from 'fast-glob'
import { afterEach, beforeEach, describe, expect, it, type Mocked, vi } from 'vitest'
import { YankConfig } from './config'

vi.mock('cosmiconfig')
vi.mock('node:fs/promises')
vi.mock('fast-glob')

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
			if (pathStr === 'src' || pathStr === 'docs/') return { isDirectory: () => true } as fs.Stats

			if (pathStr === 'README.md') return { isDirectory: () => false } as fs.Stats

			throw new Error(`ENOENT: no such file or directory, stat '${pathStr}'`)
		})

		vi.mocked(fg.isDynamicPattern).mockImplementation((pattern: string) => pattern.includes('*'))

		argvSpy = vi.spyOn(process, 'argv', 'get')
	})

	afterEach(() => {
		argvSpy.mockRestore()
	})

	it('should use the default include pattern when no arguments are provided', async () => {
		argvSpy.mockReturnValue(['node', 'yank'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['**/*'])
	})

	it('should convert a positional directory argument into a glob pattern', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'src'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*'])
	})

	it('should convert a directory from --include flag into a glob pattern', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--include', 'src'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*'])
	})

	it('should handle a directory argument with a trailing slash', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'docs/'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['docs/**/*'])
	})

	it('should keep a positional file argument as is', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'README.md'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['README.md'])
	})

	it('should keep a glob-like positional argument as is', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'lib/**/*.ts'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['lib/**/*.ts'])
	})

	it('should keep a glob-like --include argument as is', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--include', 'lib/**/*.ts'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['lib/**/*.ts'])
	})

	it('should correctly combine positional arguments and --include flags', async () => {
		argvSpy.mockReturnValue(['node', 'yank', 'src', '--include', 'README.md', '--include', 'lib/**/*.ts'])
		const config = await YankConfig.init()
		expect(config.include).toEqual(['src/**/*', 'README.md', 'lib/**/*.ts'])
	})

	it('should throw error for invalid glob patterns with unclosed brackets', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--include', 'src/[unclosed'])
		await expect(YankConfig.init()).rejects.toThrow('Invalid glob pattern: src/[unclosed. Unclosed character class.')
	})

	it('should throw error for invalid glob patterns with unclosed braces', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--include', 'src/{unclosed'])
		await expect(YankConfig.init()).rejects.toThrow('Invalid glob pattern: src/{unclosed. Unclosed brace expansion.')
	})

	it('should throw error for invalid glob patterns with unclosed parentheses', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--include', 'src/(unclosed'])
		await expect(YankConfig.init()).rejects.toThrow('Invalid glob pattern: src/(unclosed. Unclosed group.')
	})

	it('should throw error for invalid langMap value in argv', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--lang-map', '{"LICENSE":"invalid-language"}'])
		await expect(YankConfig.init()).rejects.toThrow(
			"Configuration error: langMap value 'invalid-language' for 'LICENSE' is not a valid language",
		)
	})

	it('should throw error for invalid langMap value type in argv', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--lang-map', '{"LICENSE":123}'])
		await expect(YankConfig.init()).rejects.toThrow("Configuration error: langMap value for 'LICENSE' must be a string")
	})
})

describe('YankConfig.init with config file loading', () => {
	let argvSpy: ReturnType<typeof vi.spyOn>
	let cosmiconfigMock: Mocked<PublicExplorer>

	beforeEach(async () => {
		vi.resetAllMocks()

		const { cosmiconfig } = vi.mocked(await import('cosmiconfig'))
		cosmiconfigMock = {
			search: vi.fn().mockResolvedValue(null),
			load: vi.fn().mockResolvedValue(null),
			clearLoadCache: vi.fn(),
			clearSearchCache: vi.fn(),
			clearCaches: vi.fn(),
		}
		cosmiconfig.mockReturnValue(cosmiconfigMock)

		const fsPromisesMock = vi.mocked(await import('node:fs/promises'))
		fsPromisesMock.readFile.mockResolvedValue(JSON.stringify({ version: '1.2.3' }))

		vi.mocked(fg.isDynamicPattern).mockImplementation((pattern: string) => pattern.includes('*'))

		argvSpy = vi.spyOn(process, 'argv', 'get')
	})

	afterEach(() => {
		argvSpy.mockRestore()
	})

	it('should use cosmiconfig.load() when --config flag is provided', async () => {
		const customConfigPath = 'custom/path/yank.json'
		const customConfig = { clip: true, include: ['lib/**'] }
		argvSpy.mockReturnValue(['node', 'yank', '--config', customConfigPath])
		cosmiconfigMock.load.mockResolvedValue({
			config: customConfig,
			filepath: customConfigPath,
		})

		const config = await YankConfig.init()

		expect(cosmiconfigMock.load).toHaveBeenCalledWith(customConfigPath)
		expect(cosmiconfigMock.search).not.toHaveBeenCalled()
		expect(config.clip).toBe(true)
		expect(config.include).toEqual(['lib/**'])
	})

	it('should throw an error if --config path is not found', async () => {
		const customConfigPath = 'non/existent/config.toml'
		argvSpy.mockReturnValue(['node', 'yank', '--config', customConfigPath])
		cosmiconfigMock.load.mockResolvedValue(null)

		await expect(YankConfig.init()).rejects.toThrow(
			`Configuration file not found or failed to load at: ${customConfigPath}`,
		)
	})

	it('should use cosmiconfig.search() when --config flag is not provided', async () => {
		const foundConfig = { stats: true }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: foundConfig,
			filepath: '/project/yank.toml',
		})

		const config = await YankConfig.init()

		expect(cosmiconfigMock.search).toHaveBeenCalled()
		expect(cosmiconfigMock.load).not.toHaveBeenCalled()
		expect(config.stats).toBe(true)
	})

	it('should throw error for invalid include in config file', async () => {
		const invalidConfig = { include: 'not-an-array' }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: include must be an array of strings')
	})

	it('should throw error for invalid exclude in config file', async () => {
		const invalidConfig = { exclude: 123 }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: exclude must be an array of strings')
	})

	it('should throw error for invalid fileTemplate in config file', async () => {
		const invalidConfig = { fileTemplate: true }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: fileTemplate must be a string')
	})

	it('should throw error for invalid codeTemplate in config file', async () => {
		const invalidConfig = { codeTemplate: [] }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: codeTemplate must be a string')
	})

	it('should throw error for invalid clip in config file', async () => {
		const invalidConfig = { clip: 'yes' }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: clip must be a boolean')
	})

	it('should throw error for invalid debug in config file', async () => {
		const invalidConfig = { debug: 0 }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: debug must be a boolean')
	})

	it('should throw error for invalid langMap in config file', async () => {
		const invalidConfig = { langMap: 'not-an-object' }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow('Configuration error: langMap must be an object')
	})

	it('should throw error for invalid langMap value in config file', async () => {
		const invalidConfig = { langMap: { LICENSE: 'invalid-language' } }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow(
			"Configuration error: langMap value 'invalid-language' for 'LICENSE' is not a valid language",
		)
	})

	it('should throw error for invalid langMap value type in config file', async () => {
		const invalidConfig = { langMap: { LICENSE: 123 } }
		argvSpy.mockReturnValue(['node', 'yank'])
		cosmiconfigMock.search.mockResolvedValue({
			config: invalidConfig,
			filepath: '/project/yank.toml',
		})

		await expect(YankConfig.init()).rejects.toThrow("Configuration error: langMap value for 'LICENSE' must be a string")
	})
})
