import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cosmiconfig } from 'cosmiconfig'
import { loadToml } from 'cosmiconfig-toml-loader'
import fg from 'fast-glob'
import cac from 'cac'
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

function buildCli(_version: string) {
	const cli = cac(moduleName)

	cli.usage('Usage: $0 [paths...] [options]')
	cli.option('-c, --clip', 'Output to clipboard.', {
		default: false,
	})
	cli.option(
		'-i, --include [patterns...]',
		'Glob patterns for files to include. Combined with any positional paths.',
		{
			type: [] as string[],
			default: [] as string[],
		},
	)
	cli.option('-x, --exclude [patterns...]', 'Glob patterns to exclude.', {
		type: [] as string[],
		default: [] as string[],
	})
	cli.option('-H, --file-template <template>', 'Template for header (var: {filePath})', {
		default: '--- {filePath} ---',
	})
	cli.option(
		'-B, --code-template <template>',
		'Template for body (vars: {language}, {content})',
		{
			default: DEFAULT_CODE_TEMPLATE,
		},
	)
	cli.option('-h, --help', 'Display this message.')
	cli.option('-v, --version', 'Display version number.')
	cli.option('-C, --config <path>', 'Path to a custom config.')
	cli.option('--debug', 'Enable debug output.', {
		default: false,
	})
	cli.option(
		'--lang-map <json>',
		'JSON string of language overrides (e.g., \'{"LICENSE":"text"}\')',
	)
	cli.option('-p, --preview', 'Enable interactive preview mode to select files.', {
		default: false,
	})
	cli.option(
		'-w, --workspace <path>',
		'Path to package in monorepo to yank with direct workspace dependencies.',
	)
	cli.option(
		'-r, --workspace-recursive',
		'Resolve workspace dependencies recursively when using --workspace.',
		{
			default: false,
		},
	)
	cli.option('--max-size <bytes>', 'Skip files larger than this size (in bytes, 0 = no limit).', {
		default: 0,
	})

	return cli
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
		const preCli = cac(moduleName)
		preCli.option('-C, --config <path>', 'Path to a custom config.')

		const preParsed = preCli.parse(process.argv, { run: false })
		const customConfigPath = preParsed.options.config as string | undefined
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

		const cli = buildCli(appVersion) // version is passed for future use

		for (const [key, value] of Object.entries(fileConfig)) {
			if (key !== 'langMap') {
				cli.option(`--${key}`, '', { default: value })
			}
		}

		const argv = cli.parse(process.argv)

		if (argv.options.help) {
			cli.outputHelp()
			process.exit(0)
		}

		if (argv.options.version) {
			console.log(appVersion)
			process.exit(0)
		}

		const cliOptions = argv.options as Record<string, unknown>

		let langMap: Record<string, string> = {}
		if (argv.options.langMap) {
			try {
				langMap = JSON.parse(argv.options.langMap as string)
			} catch {
				throw new Error('Invalid JSON for --lang-map')
			}
		}

		const positionalArgs = argv.args.map(String)
		const rawIncludePatterns = [...positionalArgs, ...((cliOptions.include as string[]) ?? [])]
		validateGlobPatterns(rawIncludePatterns)

		const includes =
			rawIncludePatterns.length > 0
				? await expandDirectoryPatterns(rawIncludePatterns)
				: ['**/*']

		const binaryIgnorePatterns = BINARY_FILE_EXTENSIONS.map((ext) => `**/*.${ext}`)
		const excludes = [
			...DEFAULT_EXCLUDE_PATTERNS,
			...binaryIgnorePatterns,
			...((cliOptions.exclude as string[]) ?? []),
		]

		if (langMap) {
			validateLangMapValues(langMap)
		}

		const { workspaceDirect, workspaceRecursive } = resolveWorkspaceArgs({
			w: cliOptions.workspace as string | undefined,
			workspaceRecursive: cliOptions.workspaceRecursive as boolean | undefined,
		})

		const config = new YankConfig({
			clip: cliOptions.clip as boolean,
			include: includes,
			exclude: excludes,
			fileTemplate: cliOptions.fileTemplate as string,
			codeTemplate: cliOptions.codeTemplate as string,
			stats: true,
			tokens: true,
			debug: cliOptions.debug as boolean,
			preview: cliOptions.preview as boolean,
			langMap: langMap || {},
			workspaceDirect,
			workspaceRecursive,
			maxSize: cliOptions.maxSize as number,
		})

		validateTemplates(config.fileTemplate, config.codeTemplate)

		if (workspaceDirect) {
			await validateWorkspacePath(workspaceDirect)
		}

		return config
	}
}
