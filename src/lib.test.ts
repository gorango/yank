import type { ProcessedFile, YankConfigCtor } from './types'
import { describe, expect, it } from 'vitest'
import { generateOutput } from './lib'

describe('generateOutput', () => {
	const mockFiles: ProcessedFile[] = [
		{ relPath: 'src/main.ts', content: 'console.log("hello");' },
		{ relPath: 'README.md', content: '# My Project' },
	]

	it('should generate output using the default templates', () => {
		const mockConfig: YankConfigCtor = {
			fileTemplate: '--- {filePath} ---',
			codeTemplate: '```{language}\n{content}\n```',
		} as YankConfigCtor

		const output = generateOutput(mockFiles, mockConfig)

		const expected = `--- src/main.ts ---
\`\`\`typescript
console.log("hello");
\`\`\`

--- README.md ---
\`\`\`markdown
# My Project
\`\`\``
		expect(output).toBe(expected)
	})

	it('should generate output using custom templates', () => {
		const mockConfig: YankConfigCtor = {
			fileTemplate: '### FILE: {filePath}',
			codeTemplate: '[[CODE]]\n{content}\n[[/CODE]]',
		} as YankConfigCtor

		const output = generateOutput(mockFiles, mockConfig)

		const expected = `### FILE: src/main.ts
[[CODE]]
console.log("hello");
[[/CODE]]

### FILE: README.md
[[CODE]]
# My Project
[[/CODE]]`
		expect(output).toBe(expected)
	})

	it('should handle an empty file list', () => {
		const mockConfig: YankConfigCtor = {
			fileTemplate: '--- {filePath} ---',
			codeTemplate: '```{language}\n{content}\n```',
		} as YankConfigCtor
		const output = generateOutput([], mockConfig)
		expect(output).toBe('')
	})
})
