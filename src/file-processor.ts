import type { YankConfig } from './config.js'
import type { ProcessedFile } from './types.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import ignore from 'ignore'

export async function processFiles(config: YankConfig): Promise<ProcessedFile[]> {
	const ignorer = ignore().add(config.exclude)

	const gitignorePath = path.resolve(process.cwd(), '.gitignore')
	try {
		const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8')
		ignorer.add(gitignoreContent)
		if (config.debug)
			console.debug('Loaded rules from local .gitignore file.')
	}
	catch {
		if (config.debug)
			console.debug('No local .gitignore file found. Continuing without it.')
	}

	const absolutePaths = await fg(config.include, {
		dot: true,
		absolute: true,
		onlyFiles: true,
		ignore: config.exclude,
		followSymbolicLinks: false, // avoid infinity
	})

	const filteredPaths = absolutePaths
		.filter((absPath) => {
			const relPath = path.relative(process.cwd(), absPath)
			return !ignorer.ignores(relPath)
		})
		.sort()

	if (config.debug) {
		console.debug(`Found ${filteredPaths.length} files to process after filtering.`)
	}

	const filePromises = filteredPaths.map(async (absPath) => {
		try {
			const content = await fs.readFile(absPath, 'utf-8')
			const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/')
			return { relPath, content }
		}
		catch (err) {
			if (config.debug) {
				const relPath = path.relative(process.cwd(), absPath)
				console.debug(`Skipping file due to read error: ${relPath} (${(err as Error).message})`)
			}
			return null // binary, unreadable, etc
		}
	})

	return (await Promise.all(filePromises)).filter(Boolean) as ProcessedFile[]
}
