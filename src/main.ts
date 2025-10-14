import { Buffer } from 'node:buffer'
import process from 'node:process'
import { inspect } from 'node:util'
import byteSize from 'byte-size'
import clipboard from 'clipboardy'
import { get_encoding } from 'tiktoken'
import { YankConfig } from './config.js'
import { processFiles } from './file-processor.js'
import { generateOutput } from './lib.js'

async function main() {
	try {
		const config = await YankConfig.init()
		if (config.debug) {
			console.debug('Yank starting with configuration:')
			console.debug(inspect(config, { depth: null, colors: true, breakLength: 120 }))
		}

		const files = await processFiles(config)
		if (files.length === 0) {
			console.error('No files matched the include/ignore patterns.')
			process.exit(1)
		}

		const output = generateOutput(files, config)

		if (config.clip) {
			await clipboard.write(output)
			console.error(`Yanking ${files.length} files into clipboard.`)
		}
		else {
			console.log(output)
		}

		if (config.stats) {
			const totalLines = files.reduce((acc, file) => acc + file.lineCount, 0)
			const size = byteSize(Buffer.byteLength(output, 'utf-8'))

			console.error('---')
			console.error(`Size: ${size}`)
			console.error(`Files: ${files.length}`)
			console.error(`Lines: ${totalLines.toLocaleString()}`)
			if (config.tokens) {
				let tokenCount = 0
				const encoding = get_encoding('cl100k_base')
				try {
					tokenCount = encoding.encode(output).length
				}
				finally {
					encoding.free()
				}
				console.error(`Tokens: ${tokenCount.toLocaleString()}`)
			}
		}
	}
	catch (error) {
		if (error instanceof Error)
			console.error(`Error: ${error.message}`)
		else
			console.error('An unknown error occurred.')
		process.exit(1)
	}
}

main()
