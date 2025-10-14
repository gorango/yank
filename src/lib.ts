import type { YankConfig } from './config.js'
import type { ProcessedFile } from './types.js'
import { DEFAULT_CODE_TEMPLATE } from './config.js'
import { getLanguage } from './language-map.js'

/**
 * Generates the final output string by applying the configured templates
 * to each processed file.
 */
export function generateOutput(
	files: ProcessedFile[],
	config: YankConfig,
): string {
	const outputChunks: string[] = []

	for (const file of files) {
		const language = getLanguage(file.relPath)
		const isMarkdown = language === 'markdown'

		const header = config.fileTemplate.replace('{filePath}', file.relPath)

		// Use 4 backticks for markdown files if using the default template
		const template = isMarkdown && config.codeTemplate === DEFAULT_CODE_TEMPLATE
			? `\`${DEFAULT_CODE_TEMPLATE}\``
			: config.codeTemplate

		const codeBlock = template
			.replace('{language}', language)
			.replace('{content}', file.content)

		outputChunks.push(`${header}\n${codeBlock}`)
	}

	return outputChunks.join('\n\n')
}
