import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './main'

vi.mock('./file-processor')
vi.mock('./lib')

describe('main', () => {
	let argvSpy: ReturnType<typeof vi.spyOn>
	let consoleSpy: ReturnType<typeof vi.spyOn>
	let processExitSpy: ReturnType<typeof vi.spyOn>

	beforeEach(async () => {
		vi.resetAllMocks()

		argvSpy = vi.spyOn(process, 'argv', 'get')
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})

		const { processFiles } = vi.mocked(await import('./file-processor'))
		processFiles.mockResolvedValue({
			files: [
				{ relPath: 'src/main.ts', content: 'console.log("hello")', lineCount: 1 },
				{ relPath: 'README.md', content: '# README', lineCount: 1 },
			],
			stats: { totalFiles: 2, processedFiles: 2, skippedFiles: 0, skippedReasons: new Map() },
		})

		const { generateOutput } = vi.mocked(await import('./lib'))
		generateOutput.mockResolvedValue('mocked output')
	})

	afterEach(() => {
		argvSpy.mockRestore()
		consoleSpy.mockRestore()
		processExitSpy.mockRestore()
	})

	it('should handle preview mode with file selection', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--preview'])

		// Mock the dynamic import
		const mockCheckbox = vi.fn().mockResolvedValue(['0']) // Select first file
		vi.doMock('@inquirer/prompts', () => ({
			checkbox: mockCheckbox,
		}))

		await main()

		expect(mockCheckbox).toHaveBeenCalledWith({
			message: 'Select files to yank (use space to toggle, enter to confirm):',
			choices: [
				{ name: 'src/main.ts', value: '0' },
				{ name: 'README.md', value: '1' },
			],
			pageSize: 20,
		})

		// Check that only selected file is processed
		const { generateOutput } = vi.mocked(await import('./lib'))
		expect(generateOutput).toHaveBeenCalledWith([
			{ relPath: 'src/main.ts', content: 'console.log("hello")', lineCount: 1 },
		], expect.any(Object))
	})

	it('should exit if no files selected in preview mode', async () => {
		argvSpy.mockReturnValue(['node', 'yank', '--preview'])

		const mockCheckbox = vi.fn().mockResolvedValue([]) // No selection
		vi.doMock('@inquirer/prompts', () => ({
			checkbox: mockCheckbox,
		}))

		await main()

		expect(consoleSpy).toHaveBeenCalledWith('No files selected. Exiting.')
		expect(processExitSpy).toHaveBeenCalledWith(0)
	})
})
