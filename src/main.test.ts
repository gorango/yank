import process from 'node:process'
import { checkbox } from '@inquirer/prompts'
import clipboard from 'clipboardy'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { main } from './main'

vi.mock('./file-processor')
vi.mock('./output')
vi.mock('@inquirer/prompts')
vi.mock('clipboardy', () => ({
	default: {
		write: vi.fn(),
		read: vi.fn(),
	},
}))

const mockInit = vi.hoisted(() => vi.fn())
vi.mock('./config', () => ({
	YankConfig: {
		init: mockInit,
	},
}))

describe('main', () => {
	let mockProcessExit: MockInstance<(code?: string | number | null | undefined) => never>
	let mockConsoleError: MockInstance<(...data: unknown[]) => void>
	const mockedCheckbox = vi.mocked(checkbox)
	const defaultConfig = {
		clip: false,
		include: ['**/*'],
		exclude: [],
		fileTemplate: '--- {filePath} ---',
		codeTemplate: '```{language}\n{content}\n```',
		stats: true,
		tokens: true,
		debug: false,
		preview: false,
		langMap: {},
	}

	beforeEach(async () => {
		vi.resetAllMocks()

		mockInit.mockResolvedValue(defaultConfig)
		mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		mockProcessExit = vi
			.spyOn(process, 'exit')
			.mockImplementation((() => {}) as (code?: string | number | null | undefined) => never)

		const { processFiles } = vi.mocked(await import('./file-processor'))
		processFiles.mockResolvedValue({
			files: [
				{
					relPath: 'src/main.ts',
					content: 'console.log("hello")',
					lineCount: 1,
				},
				{ relPath: 'README.md', content: '# README', lineCount: 1 },
			],
			stats: {
				totalFiles: 2,
				processedFiles: 2,
				skippedFiles: 0,
				skippedReasons: new Map(),
			},
		})

		const { generateOutput } = vi.mocked(await import('./output'))
		generateOutput.mockResolvedValue('mocked output')
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('should handle preview mode with file selection', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, preview: true })
		mockedCheckbox.mockResolvedValue(['0'])
		await main()
		expect(mockedCheckbox).toHaveBeenCalledWith({
			message: 'Select files to yank (use space to toggle, enter to confirm):',
			choices: [
				{ name: 'src/main.ts', value: '0' },
				{ name: 'README.md', value: '1' },
			],
			pageSize: 20,
		})
		const { generateOutput } = vi.mocked(await import('./output'))
		expect(generateOutput).toHaveBeenCalledWith(
			[
				{
					relPath: 'src/main.ts',
					content: 'console.log("hello")',
					lineCount: 1,
				},
			],
			expect.any(Object),
		)
	})

	it('should exit if no files are selected in preview mode', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, preview: true })
		mockedCheckbox.mockResolvedValue([])
		await main()
		expect(mockedCheckbox).toHaveBeenCalled()
		expect(mockConsoleError).toHaveBeenCalledWith('No files selected. Exiting.')
		expect(mockProcessExit).toHaveBeenCalledWith(0)
	})

	it('should handle clipboard errors gracefully', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, clip: true, stats: false })
		vi.mocked(clipboard.write).mockRejectedValue(new Error('Clipboard is busy'))
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('Clipboard error: Clipboard is busy')
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})

	it('should log debug information when debug is enabled', async () => {
		const mockConsoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {})
		mockInit.mockResolvedValue({ ...defaultConfig, debug: true })
		await main()
		expect(mockConsoleDebug).toHaveBeenCalledWith('Yank starting with configuration:')
		expect(mockConsoleDebug).toHaveBeenCalledTimes(2)
		const secondCall = mockConsoleDebug.mock.calls[1][0]
		expect(secondCall).toMatch(/debug:.*true/)
		mockConsoleDebug.mockRestore()
	})

	it('should exit with error when no files match patterns', async () => {
		const { processFiles } = vi.mocked(await import('./file-processor'))
		processFiles.mockResolvedValue({
			files: [],
			stats: {
				totalFiles: 0,
				processedFiles: 0,
				skippedFiles: 0,
				skippedReasons: new Map(),
			},
		})
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('No files matched the include/ignore patterns.')
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})

	it('should handle errors in preview mode', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, preview: true })
		mockedCheckbox.mockRejectedValue(new Error('Preview error'))
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('Error in preview mode: Preview error')
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})

	it('should handle clipboard validation failure', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, clip: true, stats: false })
		vi.mocked(clipboard.write).mockResolvedValue()
		vi.mocked(clipboard.read).mockResolvedValue('different output')
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith(
			'Clipboard error: Clipboard write validation failed - content mismatch',
		)
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})

	it('should log stats with skipped files', async () => {
		const { processFiles } = vi.mocked(await import('./file-processor'))
		processFiles.mockResolvedValue({
			files: [
				{
					relPath: 'src/main.ts',
					content: 'console.log("hello")',
					lineCount: 1,
				},
			],
			stats: {
				totalFiles: 1,
				processedFiles: 1,
				skippedFiles: 2,
				skippedReasons: new Map([
					['binary', 1],
					['ignored', 1],
				]),
			},
		})
		mockInit.mockResolvedValue({ ...defaultConfig, stats: true, tokens: false })
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('---')
		expect(mockConsoleError).toHaveBeenCalledWith('Size: 13 B')
		expect(mockConsoleError).toHaveBeenCalledWith('Files: 1')
		expect(mockConsoleError).toHaveBeenCalledWith('Lines: 1')
		expect(mockConsoleError).toHaveBeenCalledWith('Skipped Files: 2')
		expect(mockConsoleError).toHaveBeenCalledWith('  binary: 1')
		expect(mockConsoleError).toHaveBeenCalledWith('  ignored: 1')
	})

	it('should log stats with tokens', async () => {
		mockInit.mockResolvedValue({ ...defaultConfig, stats: true, tokens: true })
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('---')
		expect(mockConsoleError).toHaveBeenCalledWith('Size: 13 B')
		expect(mockConsoleError).toHaveBeenCalledWith('Files: 2')
		expect(mockConsoleError).toHaveBeenCalledWith('Lines: 2')
		expect(mockConsoleError).toHaveBeenCalledWith('Tokens: 2')
	})

	it('should log error stack when debug is enabled', async () => {
		const { processFiles } = vi.mocked(await import('./file-processor'))
		processFiles.mockRejectedValue(new Error('Test error'))
		mockInit.mockResolvedValue({ ...defaultConfig, debug: true })
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('Error: Test error')
		expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Test error'))
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})
})
