import { Buffer } from 'node:buffer'
import process from 'node:process'
import { inspect } from 'node:util'
import byteSize from 'byte-size'
import clipboard from 'clipboardy'
import { YankConfig } from './config.js'
import { processFiles } from './file-processor.js'
import { generateOutput } from './output.js'
import { estimateTokens } from './token-estimator.js'

export async function main() {
	let config: YankConfig | undefined

	try {
		config = await YankConfig.init()
		if (config.debug) {
			console.debug('Yank starting with configuration:')
			console.debug(inspect(config, { depth: null, colors: true, breakLength: 120 }))
		}

		let { files, stats } = await processFiles(config)
		if (files.length === 0) {
			console.error('No files matched the include/ignore patterns.')
			process.exit(1)
		}

		if (config.preview) {
			try {
				const { checkbox } = await import('@inquirer/prompts')
				const choices = files.map((file, index) => ({
					name: file.relPath,
					value: index.toString(),
				}))
				const selectedIndices = await checkbox({
					message: 'Select files to yank (use space to toggle, enter to confirm):',
					choices,
					pageSize: 20,
				})
				if (selectedIndices.length === 0) {
					console.error('No files selected. Exiting.')
					process.exit(0)
				}
				files = files.filter((_, index) => selectedIndices.includes(index.toString()))
			} catch (error) {
				console.error(`Error in preview mode: ${error instanceof Error ? error.message : 'Unknown error'}`)
				process.exit(1)
			}
		}

		const output = await generateOutput(files, config)

		if (config.clip) {
			try {
				await clipboard.write(output)
				const readBack = await clipboard.read()
				if (readBack !== output) {
					throw new Error('Clipboard write validation failed - content mismatch')
				}
				console.error(`Yanking ${files.length} files into clipboard.`)
			} catch (error) {
				console.error(`Clipboard error: ${error instanceof Error ? error.message : 'Unknown error'}`)
				process.exit(1)
			}
		} else {
			console.log(output)
		}

		if (config.stats) {
			const totalLines = files.reduce((acc, file) => acc + file.lineCount, 0)
			const size = byteSize(Buffer.byteLength(output, 'utf-8'))

			console.error('---')
			console.error(`Size: ${size}`)
			console.error(`Files: ${files.length}`)
			console.error(`Lines: ${totalLines.toLocaleString()}`)
			if (stats.skippedFiles > 0) {
				console.error(`Skipped Files: ${stats.skippedFiles}`)
				for (const [reason, count] of stats.skippedReasons) {
					console.error(`  ${reason}: ${count}`)
				}
			}
			if (config.tokens) {
				const tokenCount = estimateTokens(output)
				console.error(`Tokens: ${tokenCount.toLocaleString()}`)
			}
		}
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
		if (config?.debug && error instanceof Error) {
			console.error(error.stack)
		}
		process.exit(1)
	}
}

main().catch(() => {})
