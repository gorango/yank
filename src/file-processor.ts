import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import type { Ignore } from 'ignore'
import ignore from 'ignore'
import type { YankConfig } from './config.js'
import type { FileProcessingStats, ProcessedFile } from './types.js'

async function buildIgnoreHierarchy(config: YankConfig): Promise<Map<string, Ignore>> {
	const cwd = process.cwd()
	const dirToIgnorer = new Map<string, Ignore>()

	const rootIgnorer = ignore().add(config.exclude)
	dirToIgnorer.set(cwd, rootIgnorer)

	const gitignorePaths = await fg('**/.gitignore', {
		dot: true,
		absolute: true,
		ignore: ['**/node_modules/**', '**/.git/**'],
	})

	gitignorePaths.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length)

	for (const absPath of gitignorePaths) {
		const dirPath = path.dirname(absPath)
		const parentDirPath = path.dirname(dirPath)
		const parentIgnorer = dirToIgnorer.get(parentDirPath) ?? rootIgnorer

		try {
			const content = await fs.readFile(absPath, 'utf-8')
			dirToIgnorer.set(dirPath, ignore().add(parentIgnorer).add(content))
			if (config.debug) console.debug(`Loaded: ${path.relative(cwd, absPath)}`)
		} catch {
			if (config.debug) console.debug(`Failed to read: ${path.relative(cwd, absPath)}`)
		}
	}

	return dirToIgnorer
}

export async function processFiles(
	config: YankConfig,
): Promise<{ files: ProcessedFile[]; stats: FileProcessingStats }> {
	const cwd = process.cwd()
	const dirToIgnorer = await buildIgnoreHierarchy(config)

	const allFiles = await fg(config.include, {
		dot: true,
		absolute: true,
		onlyFiles: true,
		ignore: ['**/node_modules/**', '**/.git/**'],
		followSymbolicLinks: false,
	})

	const filteredPaths = allFiles
		.filter((absPath) => {
			const dirPath = path.dirname(absPath)

			let ignorer: Ignore | undefined
			let ignorerDir: string | undefined
			let current = dirPath
			while (current.startsWith(cwd)) {
				if (dirToIgnorer.has(current)) {
					ignorer = dirToIgnorer.get(current)
					ignorerDir = current
					break
				}
				if (current === cwd) break
				current = path.dirname(current)
			}

			if (!ignorer || !ignorerDir) {
				ignorer = dirToIgnorer.get(cwd) as Ignore
				ignorerDir = cwd
			}

			const relConfigPath = path.relative(ignorerDir, absPath)
			let isIgnored = ignorer.ignores(relConfigPath)

			if (isIgnored && path.basename(absPath) === '.gitignore' && dirPath === ignorerDir) {
				const parentDir = path.dirname(dirPath)
				const parentIgnorer = dirToIgnorer.get(parentDir) ?? (dirToIgnorer.get(cwd) as Ignore)
				const relParentPath = path.relative(cwd, absPath)
				isIgnored = parentIgnorer.ignores(relParentPath)
			}

			return !isIgnored
		})
		.sort()

	if (config.debug) {
		console.debug(`Files found: ${allFiles.length}. After ignore rules: ${filteredPaths.length}.`)
	}

	const skippedReasons = new Map<string, number>()
	let processedCount = 0
	let skippedCount = 0

	const filePromises = filteredPaths.map(async (absPath) => {
		try {
			const content = await fs.readFile(absPath, 'utf-8')
			const relPath = path.relative(cwd, absPath).replace(/\\/g, '/')
			processedCount++
			return { relPath, content, lineCount: content.split('\n').length }
		} catch (error) {
			skippedCount++
			const reason = error instanceof Error ? error.message : 'Unknown error'
			skippedReasons.set(reason, (skippedReasons.get(reason) || 0) + 1)

			if (config.debug) {
				console.debug(`Failed to read ${path.relative(cwd, absPath)}: ${reason}`)
			}
			return null
		}
	})

	const processedFiles = (await Promise.all(filePromises)).filter(Boolean) as ProcessedFile[]

	const stats: FileProcessingStats = {
		totalFiles: filteredPaths.length,
		processedFiles: processedCount,
		skippedFiles: skippedCount,
		skippedReasons,
	}

	return { files: processedFiles, stats }
}
