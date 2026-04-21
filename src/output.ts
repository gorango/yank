import type { YankConfig } from './config.js'
import { DEFAULT_CODE_TEMPLATE } from './defaults.js'
import { getLanguage } from './language-map.js'
import type { ProcessedFile } from './types.js'

/**
 * Generates the final output string by applying the configured templates
 * to each processed file.
 */
export async function generateOutput(files: ProcessedFile[], config: YankConfig): Promise<string> {
	const outputChunks: string[] = []

	for (const file of files) {
		const filename = file.relPath.split('/').pop() || file.relPath
		let language = config.langMap[filename] || config.langMap[file.relPath]
		if (!language) {
			language = await getLanguage(file.relPath)
		}

		const header = config.fileTemplate.replace('{filePath}', file.relPath)

		// Use 4 backticks for markdown files if using the default template
		const template =
			language === 'markdown' && config.codeTemplate === DEFAULT_CODE_TEMPLATE
				? `\`${DEFAULT_CODE_TEMPLATE}\``
				: config.codeTemplate

		const codeBlock = template.replace('{language}', language).replace('{content}', file.content)

		outputChunks.push(`${header}\n${codeBlock}`)
	}

	return outputChunks.join('\n\n')
}
