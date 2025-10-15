import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './main'

vi.mock('./file-processor')
vi.mock('./lib')

vi.mock('clipboardy', () => ({
	write: vi.fn().mockRejectedValue(new Error('Clipboard is busy')),
}))

describe('main', () => {
	beforeEach(async () => {
		vi.resetAllMocks()

		vi.spyOn(process, 'argv', 'get')
		vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.spyOn(process, 'exit').mockImplementation((_code) => {
			throw new Error('process.exit called')
		})

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

	it('should handle preview mode with file selection', async () => {
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--preview'])

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

	it.skip('should exit if no files selected in preview mode', async () => {
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--preview'])

		const mockCheckbox = vi.fn().mockResolvedValue([]) // No selection
		vi.doMock('@inquirer/prompts', () => ({
			checkbox: mockCheckbox,
		}))

		await main()

		expect(mockCheckbox).toHaveBeenCalled()
		expect(vi.spyOn(console, 'error').mock.calls.some((call) => call[0] === 'No files selected. Exiting.')).toBe(true)
		expect(vi.spyOn(process, 'exit').mock.calls.length).toBeGreaterThan(0)
	})

	it.skip('should handle clipboard errors gracefully', async () => {
		vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'yank', '--clip'])

		await main()

		expect(vi.spyOn(console, 'error').mock.calls.some((call) => call[0] === 'Error: Clipboard is busy')).toBe(true)
	})
})
