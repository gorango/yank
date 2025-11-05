import process from 'node:process'
import { checkbox } from '@inquirer/prompts'
import clipboard from 'clipboardy'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { main } from './main'

vi.mock('./file-processor')
vi.mock('./lib')
vi.mock('@inquirer/prompts')
vi.mock('clipboardy', () => ({
	default: {
		write: vi.fn(),
		read: vi.fn(),
	},
}))

describe('main', () => {
	let mockProcessExit: MockInstance<(code?: string | number | null | undefined) => never>
	let mockConsoleError: MockInstance<(...data: unknown[]) => void>
	const mockedCheckbox = vi.mocked(checkbox)

	beforeEach(async () => {
		vi.resetAllMocks()

		vi.spyOn(process, 'argv', 'get')
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

		const { generateOutput } = vi.mocked(await import('./lib'))
		generateOutput.mockResolvedValue('mocked output')
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('should handle preview mode with file selection', async () => {
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--preview'])
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
		const { generateOutput } = vi.mocked(await import('./lib'))
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
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--preview'])
		mockedCheckbox.mockResolvedValue([])
		await main()
		expect(mockedCheckbox).toHaveBeenCalled()
		expect(mockConsoleError).toHaveBeenCalledWith('No files selected. Exiting.')
		expect(mockProcessExit).toHaveBeenCalledWith(0)
	})

	it('should handle clipboard errors gracefully', async () => {
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--clip'])
		vi.mocked(clipboard.write).mockRejectedValue(new Error('Clipboard is busy'))
		await main()
		expect(mockConsoleError).toHaveBeenCalledWith('Clipboard error: Clipboard is busy')
		expect(mockProcessExit).toHaveBeenCalledWith(1)
	})
})
