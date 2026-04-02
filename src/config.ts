import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cosmiconfig } from 'cosmiconfig'
import { loadToml } from 'cosmiconfig-toml-loader'
import fg from 'fast-glob'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {
	BINARY_FILE_EXTENSIONS,
	DEFAULT_CODE_TEMPLATE,
	DEFAULT_EXCLUDE_PATTERNS,
} from './defaults.js'
import { languageMap } from './language-map.js'
import type { YankConfigCtor } from './types.js'

const moduleName = 'yank'

async function getPackageVersion(): Promise<string> {
	const packageJsonPath = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		'../package.json',
	)
	try {
		const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
		return pkg.version || '0.0.0'
	} catch {
		return '0.0.0'
	}
}

function createExplorer() {
	return cosmiconfig(moduleName, {
		searchPlaces: [
			'package.json',
			'yank.toml',
			'yank.yaml',
			'yank.yml',
			'yank.json',
			'yank.config.js',
			'yank.config.cjs',
			'yank.config.mjs',
		],
		loaders: {
			'.toml': loadToml,
		},
	})
}

function validateFileConfigField(
	config: Record<string, unknown>,
	key: string,
	check: (v: unknown) => boolean,
	message: string,
) {
	if (config[key] !== undefined && !check(config[key])) {
		throw new Error(`Configuration error: ${message}`)
	}
}

function validateLangMapValues(langMap: Record<string, unknown>) {
	for (const [key, value] of Object.entries(langMap)) {
		if (typeof value !== 'string') {
			throw new Error(`Configuration error: langMap value for '${key}' must be a string`)
		}
		if (!Object.values(languageMap).includes(value)) {
			throw new Error(
				`Configuration error: langMap value '${value}' for '${key}' is not a valid language`,
			)
		}
	}
}

function validateFileConfig(fileConfig: Record<string, unknown>) {
	validateFileConfigField(
		fileConfig,
		'include',
		Array.isArray,
		'include must be an array of strings',
	)
	validateFileConfigField(
		fileConfig,
		'exclude',
		Array.isArray,
		'exclude must be an array of strings',
	)
	validateFileConfigField(
		fileConfig,
		'fileTemplate',
		(v) => typeof v === 'string',
		'fileTemplate must be a string',
	)
	validateFileConfigField(
		fileConfig,
		'codeTemplate',
		(v) => typeof v === 'string',
		'codeTemplate must be a string',
	)
	validateFileConfigField(
		fileConfig,
		'clip',
		(v) => typeof v === 'boolean',
		'clip must be a boolean',
	)
	validateFileConfigField(
		fileConfig,
		'debug',
		(v) => typeof v === 'boolean',
		'debug must be a boolean',
	)
	validateFileConfigField(
		fileConfig,
		'langMap',
		(v) => typeof v === 'object' && v !== null && !Array.isArray(v),
		'langMap must be an object',
	)
	validateFileConfigField(
		fileConfig,
		'maxSize',
		(v) => typeof v === 'number' && v >= 0,
		'maxSize must be a non-negative number',
	)

	if (fileConfig.langMap) {
		validateLangMapValues(fileConfig.langMap as Record<string, unknown>)
	}
}

function buildYargs(fileConfig: Record<string, unknown>, appVersion: string) {
	return yargs(hideBin(process.argv))
		.usage('Usage: $0 [paths...] [options]')
		.option('clip', {
			alias: 'c',
			type: 'boolean',
			description: 'Output to clipboard.',
			default: false,
		})
		.option('include', {
			alias: 'i',
			type: 'array',
			string: true,
			description: 'Glob patterns for files to include. Combined with any positional paths.',
			default: [],
		})
		.option('exclude', {
			alias: 'x',
			type: 'array',
			string: true,
			description: 'Glob patterns to exclude.',
			default: [],
		})
		.option('file-template', {
			alias: 'H',
			type: 'string',
			description: 'Template for header (var: {filePath})',
			default: '--- {filePath} ---',
		})
		.option('code-template', {
			alias: 'B',
			type: 'string',
			description: 'Template for body (vars: {language}, {content})',
			default: DEFAULT_CODE_TEMPLATE,
		})
		.option('config', {
			alias: 'C',
			type: 'string',
			description: 'Path to a custom config.',
		})
		.option('debug', {
			type: 'boolean',
			description: 'Enable debug output.',
			default: false,
		})
		.option('lang-map', {
			type: 'string',
			description: 'JSON string of language overrides (e.g., \'{"LICENSE":"text"}\')',
			coerce: (value: string) => {
				try {
					return JSON.parse(value)
				} catch {
					throw new Error('Invalid JSON for --lang-map')
				}
			},
		})
		.option('preview', {
			alias: 'p',
			type: 'boolean',
			description: 'Enable interactive preview mode to select files.',
			default: false,
		})
		.option('workspace', {
			alias: 'w',
			type: 'string',
			description: 'Path to package in monorepo to yank with direct workspace dependencies.',
		})
		.option('workspace-recursive', {
			alias: 'r',
			type: 'boolean',
			description: 'Resolve workspace dependencies recursively when using --workspace.',
			default: false,
		})
		.option('max-size', {
			type: 'number',
			description: 'Skip files larger than this size (in bytes, 0 = no limit).',
			default: 0,
		})
		.config(fileConfig)
		.help()
		.alias('h', 'help')
		.version(appVersion)
		.alias('v', 'version')
}

async function expandDirectoryPatterns(patterns: string[]): Promise<string[]> {
	return Promise.all(
		patterns.map(async (pattern) => {
			if (fg.isDynamicPattern(pattern)) return pattern

			try {
				const stats = await fs.stat(pattern)
				if (stats.isDirectory()) {
					const cleanPattern = pattern.replace(/[/\\]$/, '')
					return `${cleanPattern}/**/*`
				}
				return pattern
			} catch {
				return pattern
			}
		}),
	)
}

function validateGlobPatterns(patterns: string[]) {
	for (const pattern of patterns) {
		if (pattern.includes('[') && !pattern.includes(']')) {
			throw new Error(`Invalid glob pattern: ${pattern}. Unclosed character class.`)
		}
		if (pattern.includes('{') && !pattern.includes('}')) {
			throw new Error(`Invalid glob pattern: ${pattern}. Unclosed brace expansion.`)
		}
		if (pattern.includes('(') && !pattern.includes(')')) {
			throw new Error(`Invalid glob pattern: ${pattern}. Unclosed group.`)
		}
	}
}

function resolveWorkspaceArgs(argv: { w?: unknown; workspaceRecursive?: unknown }): {
	workspaceDirect?: string
	workspaceRecursive: boolean
} {
	const w = argv.w as string | undefined
	const recursive = argv.workspaceRecursive as boolean | undefined

	if (w && typeof w === 'string') {
		return { workspaceDirect: w, workspaceRecursive: recursive ?? false }
	}
	if (recursive) {
		throw new Error(
			'Configuration error: --workspace-recursive requires --workspace to be set.',
		)
	}
	return { workspaceRecursive: false }
}

async function validateWorkspacePath(workspaceDirect: string) {
	if (path.isAbsolute(workspaceDirect)) {
		throw new Error('Configuration error: --workspace must be a relative path.')
	}
	const cwd = process.cwd()
	const pkgPath = path.resolve(cwd, workspaceDirect)
	try {
		await fs.access(pkgPath)
		await fs.access(path.join(pkgPath, 'package.json'))
	} catch {
		throw new Error(
			`Configuration error: --workspace path '${workspaceDirect}' does not exist or is not a package directory.`,
		)
	}
}

function validateTemplates(fileTemplate: string, codeTemplate: string) {
	if (!fileTemplate.includes('{filePath}')) {
		throw new Error(
			'Configuration error: --file-template must include the {filePath} placeholder.',
		)
	}
	if (!codeTemplate.includes('{content}')) {
		throw new Error(
			'Configuration error: --code-template must include the {content} placeholder.',
		)
	}
}

export class YankConfig {
	readonly clip: boolean
	readonly include: string[]
	readonly exclude: string[]
	readonly fileTemplate: string
	readonly codeTemplate: string
	readonly stats: boolean
	readonly tokens: boolean
	readonly debug: boolean
	readonly preview: boolean
	readonly langMap: Record<string, string>
	readonly workspaceDirect?: string
	readonly workspaceRecursive: boolean
	readonly maxSize: number

	private constructor(init: YankConfigCtor) {
		this.clip = init.clip
		this.include = init.include
		this.exclude = init.exclude
		this.fileTemplate = init.fileTemplate
		this.codeTemplate = init.codeTemplate
		this.stats = init.stats
		this.tokens = init.tokens
		this.debug = init.debug
		this.preview = init.preview
		this.langMap = init.langMap || {}
		this.workspaceDirect = init.workspaceDirect
		this.workspaceRecursive = init.workspaceRecursive ?? false
		this.maxSize = init.maxSize ?? 0
	}

	public static async init(): Promise<YankConfig> {
		const preParse = yargs(hideBin(process.argv))
			.option('config', {
				alias: 'C',
				type: 'string',
				description: 'Path to a custom config.',
			})
			.help(false)
			.version(false)
			.parseSync()

		const customConfigPath = preParse.config as string | undefined
		const explorer = createExplorer()

		const [appVersion, configFileResult] = await Promise.all([
			getPackageVersion(),
			customConfigPath ? explorer.load(customConfigPath) : explorer.search(),
		])

		if (customConfigPath && !configFileResult) {
			throw new Error(
				`Configuration file not found or failed to load at: ${customConfigPath}`,
			)
		}

		const fileConfig = configFileResult?.config || {}
		validateFileConfig(fileConfig)

		const argv = await buildYargs(fileConfig, appVersion).parse()

		const positionalArgs = argv._.map(String)
		const rawIncludePatterns = [...positionalArgs, ...argv.include]
		validateGlobPatterns(rawIncludePatterns)

		const includes =
			rawIncludePatterns.length > 0
				? await expandDirectoryPatterns(rawIncludePatterns)
				: ['**/*']

		const binaryIgnorePatterns = BINARY_FILE_EXTENSIONS.map((ext) => `**/*.${ext}`)
		const excludes = [...DEFAULT_EXCLUDE_PATTERNS, ...binaryIgnorePatterns, ...argv.exclude]

		if (argv.langMap) {
			validateLangMapValues(argv.langMap as Record<string, unknown>)
		}

		const { workspaceDirect, workspaceRecursive } = resolveWorkspaceArgs(argv)

		const config = new YankConfig({
			clip: argv.clip,
			include: includes,
			exclude: excludes,
			fileTemplate: argv.fileTemplate,
			codeTemplate: argv.codeTemplate,
			stats: true,
			tokens: true,
			debug: argv.debug,
			preview: argv.preview,
			langMap: argv.langMap || {},
			workspaceDirect,
			workspaceRecursive,
			maxSize: argv.maxSize,
		})

		validateTemplates(config.fileTemplate, config.codeTemplate)

		if (workspaceDirect) {
			await validateWorkspacePath(workspaceDirect)
		}

		return config
	}
}
