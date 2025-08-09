import type { YankConfig } from './config.js'
import type { ProcessedFile } from './types.js'
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

		const header = config.fileTemplate.replace('{filePath}', file.relPath)
		const codeBlock = config.codeTemplate
			.replace('{language}', language)
			.replace('{content}', file.content)

		outputChunks.push(`${header}\n${codeBlock}`)
	}

	return outputChunks.join('\n\n')
}
