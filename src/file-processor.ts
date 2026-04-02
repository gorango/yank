import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import type { Ignore } from 'ignore'
import ignore from 'ignore'
import type { YankConfig } from './config.js'
import type { FileProcessingStats, ProcessedFile } from './types.js'
import {
	findWorkspaceRoot,
	getWorkspacePackages,
	resolveWorkspaceDeps,
} from './workspace-resolver.js'

async function isFileUnderMaxSize(absPath: string, maxSize: number): Promise<boolean> {
	if (maxSize <= 0) return true
	try {
		const stat = await fs.stat(absPath)
		return stat.size <= maxSize
	} catch {
		return false
	}
}

async function buildIgnoreHierarchy(config: YankConfig): Promise<Ignore> {
	const cwd = process.cwd()
	const rootIgnorer = ignore().add(config.exclude)

	const gitignorePaths = await fg('**/.gitignore', {
		dot: true,
		absolute: true,
		ignore: ['**/node_modules/**', '**/.git/**'],
	})

	for (const absPath of gitignorePaths) {
		const dirPath = path.dirname(absPath)

		try {
			const content = await fs.readFile(absPath, 'utf-8')
			const lines = content.split('\n').filter((line) => line.trim())
			const prefixedLines = lines.map((line) => {
				if (!line || line.startsWith('#')) return line
				const isNegation = line.startsWith('!')
				const pattern = isNegation ? line.substring(1) : line
				let prefixedPattern: string
				if (!pattern.startsWith('/')) {
					const relDir = path.relative(cwd, dirPath)
					prefixedPattern = relDir ? `${relDir}/${pattern}` : pattern
				} else {
					prefixedPattern = pattern.substring(1)
				}
				return isNegation ? `!${prefixedPattern}` : prefixedPattern
			})
			rootIgnorer.add(prefixedLines)
			if (config.debug) console.debug(`Loaded: ${path.relative(cwd, absPath)}`)
		} catch {
			if (config.debug) console.debug(`Failed to read: ${path.relative(cwd, absPath)}`)
		}
	}

	return rootIgnorer
}

export async function processFiles(
	config: YankConfig,
): Promise<{ files: ProcessedFile[]; stats: FileProcessingStats }> {
	const cwd = process.cwd()
	let includes: string[]
	if (config.workspaceDirect) {
		includes = []
		const wsRoot = await findWorkspaceRoot(cwd)
		if (!wsRoot) {
			throw new Error(
				'No workspace root found (pnpm-workspace.yaml or package.json with workspaces).',
			)
		}
		const packages = await getWorkspacePackages(wsRoot)
		const wsDeps = await resolveWorkspaceDeps(
			config.workspaceDirect,
			packages,
			wsRoot,
			config.workspaceRecursive,
		)
		const workspaceDirs = new Set([config.workspaceDirect, ...wsDeps])
		for (const dir of workspaceDirs) {
			for (const pattern of config.include) {
				includes.push(`${dir}/${pattern}`)
			}
		}
		if (config.debug) {
			console.debug(`Workspace packages included: ${[...workspaceDirs].join(', ')}`)
		}
	} else {
		includes = [...config.include]
	}

	const rootIgnorer = await buildIgnoreHierarchy(config)

	const allFiles = await fg(includes, {
		dot: true,
		absolute: true,
		onlyFiles: true,
		ignore: ['**/node_modules/**', '**/.git/**'],
		followSymbolicLinks: false,
	})

	const filteredPaths = allFiles
		.filter((absPath) => {
			const relPath = path.relative(cwd, absPath)
			const isIgnored = rootIgnorer.ignores(relPath)
			return !isIgnored
		})
		.sort()

	if (config.debug) {
		console.debug(
			`Files found: ${allFiles.length}. After ignore rules: ${filteredPaths.length}.`,
		)
	}

	const results = await Promise.all(
		filteredPaths.map(async (absPath) => {
			try {
				if (!(await isFileUnderMaxSize(absPath, config.maxSize))) {
					if (config.debug)
						console.debug(`Skipped (too large): ${path.relative(cwd, absPath)}`)
					return { success: false as const, reason: 'maxSize' }
				}
				const content = await fs.readFile(absPath, 'utf-8')
				const relPath = path.relative(cwd, absPath).replace(/\\/g, '/')
				return {
					success: true as const,
					file: { relPath, content, lineCount: content.split('\n').length },
				}
			} catch (error) {
				const reason = error instanceof Error ? error.message : 'Unknown error'
				if (config.debug) {
					console.debug(`Failed to read ${path.relative(cwd, absPath)}: ${reason}`)
				}
				return { success: false as const, reason }
			}
		}),
	)

	const processedFiles: ProcessedFile[] = []
	const skippedReasons = new Map<string, number>()

	for (const result of results) {
		if (result.success) {
			processedFiles.push(result.file)
		} else {
			skippedReasons.set(result.reason, (skippedReasons.get(result.reason) || 0) + 1)
		}
	}

	const stats: FileProcessingStats = {
		totalFiles: filteredPaths.length,
		processedFiles: processedFiles.length,
		skippedFiles: filteredPaths.length - processedFiles.length,
		skippedReasons,
	}

	return { files: processedFiles, stats }
}
