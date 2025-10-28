import { describe, expect, it } from 'vitest'
import type { YankConfig } from './config'
import { generateOutput } from './lib'
import type { ProcessedFile } from './types'

// Mock config objects that match the YankConfig interface
function createMockConfig(overrides: Partial<YankConfig> = {}) {
	return {
		clip: false,
		include: [],
		exclude: [],
		fileTemplate: '--- {filePath} ---',
		codeTemplate: '```{language}\n{content}\n```',
		stats: true,
		tokens: true,
		debug: false,
		preview: false,
		langMap: {},
		...overrides,
	}
}

describe('generateOutput', () => {
	const mockFiles: ProcessedFile[] = [
		{ relPath: 'src/main.ts', content: 'console.log("hello");', lineCount: 1 },
		{
			relPath: 'README.md',
			content: '# My Project\n\n- Point 1',
			lineCount: 3,
		},
	]

	it('should generate output using the default templates', async () => {
		const mockConfig = createMockConfig()

		const output = await generateOutput(mockFiles, mockConfig)

		const expected = `--- src/main.ts ---
\`\`\`typescript
console.log("hello");
\`\`\`

--- README.md ---
\`\`\`markdown
# My Project

- Point 1
\`\`\``
		expect(output).toBe(expected)
	})

	it('should generate output using custom templates', async () => {
		const mockConfig = createMockConfig({
			fileTemplate: '### FILE: {filePath}',
			codeTemplate: '[[CODE]]\n{content}\n[[/CODE]]',
		})

		const output = await generateOutput(mockFiles, mockConfig)

		const expected = `### FILE: src/main.ts
[[CODE]]
console.log("hello");
[[/CODE]]

### FILE: README.md
[[CODE]]
# My Project

- Point 1
[[/CODE]]`
		expect(output).toBe(expected)
	})

	it('should handle an empty file list', async () => {
		const mockConfig = createMockConfig()
		const output = await generateOutput([], mockConfig)
		expect(output).toBe('')
	})

	it('should use language overrides when provided', async () => {
		const mockConfig = createMockConfig({
			langMap: {
				'README.md': 'text',
			},
		})

		const output = await generateOutput(mockFiles, mockConfig)

		const expected = `--- src/main.ts ---
\`\`\`typescript
console.log("hello");
\`\`\`

--- README.md ---
\`\`\`text
# My Project

- Point 1
\`\`\``
		expect(output).toBe(expected)
	})

	it('should prioritize filename overrides over path overrides', async () => {
		const mockConfig = createMockConfig({
			langMap: {
				'README.md': 'text',
				'src/README.md': 'markdown',
			},
		})

		const filesWithNestedReadme: ProcessedFile[] = [
			{ relPath: 'src/README.md', content: '# Nested README', lineCount: 1 },
		]

		const output = await generateOutput(filesWithNestedReadme, mockConfig)

		// Should use the filename override 'text' instead of path override 'markdown'
		const expected = `--- src/README.md ---
\`\`\`text
# Nested README
\`\`\``
		expect(output).toBe(expected)
	})
})
