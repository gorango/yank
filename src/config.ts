import type { YankConfigCtor } from './types.js'
import fs from 'node:fs/promises'
import process from 'node:process'
import { cosmiconfig } from 'cosmiconfig'
import { loadToml } from 'cosmiconfig-toml-loader'
import fg from 'fast-glob'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { BINARY_FILE_EXTENSIONS, DEFAULT_EXCLUDE_PATTERNS } from './defaults.js'

const moduleName = 'yank'
export const DEFAULT_CODE_TEMPLATE = '```{language}\n{content}```'

async function getPackageVersion(): Promise<string> {
	const packageJsonPath = new URL('../../package.json', import.meta.url)
	try {
		const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
		return pkg.version || '0.0.0'
	}
	catch {
		return '0.0.0'
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
	readonly langMap: Record<string, string>

	private constructor(init: YankConfigCtor) {
		this.clip = init.clip
		this.include = init.include
		this.exclude = init.exclude
		this.fileTemplate = init.fileTemplate
		this.codeTemplate = init.codeTemplate
		this.stats = init.stats
		this.tokens = init.tokens
		this.debug = init.debug
		this.langMap = init.langMap || {}
	}

	public static async init(): Promise<YankConfig> {
		const preParse = yargs(hideBin(process.argv))
			.option('stats', {
				alias: 's',
				type: 'boolean',
				description: 'Print summary stats.',
				default: false,
			})
			.option('tokens', {
				alias: 't',
				type: 'boolean',
				description: 'Add num tokens to stats.',
				default: false,
			})
			.option('config', {
				alias: 'C',
				type: 'string',
				description: 'Path to a custom config.',
			})
			.help(false)
			.version(false)
			.parseSync()

		const customConfigPath = preParse.config as string | undefined

		const explorer = cosmiconfig(moduleName, {
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

		const argv = await yargs(hideBin(process.argv))
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
			.option('stats', {
				alias: 's',
				type: 'boolean',
				description: 'Print summary stats.',
				default: false,
			})
			.option('tokens', {
				alias: 't',
				type: 'boolean',
				description: 'Add num tokens to stats.',
				default: false,
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
					}
					catch {
						throw new Error('Invalid JSON for --lang-map')
					}
				},
			})
			.config(fileConfig)
			.help()
			.alias('h', 'help')
			.version(appVersion)
			.alias('v', 'version')
			.parse()

		/**
		 * Processes a list of paths/patterns. If a path is a directory,
		 * it expands it to a glob pattern (e.g., 'src' -> 'src/** /*').
		 */
		async function expandDirectoryPatterns(patterns: string[]): Promise<string[]> {
			return Promise.all(
				patterns.map(async (pattern) => {
					if (fg.isDynamicPattern(pattern))
						return pattern

					try {
						const stats = await fs.stat(pattern)
						if (stats.isDirectory()) {
							const cleanPattern = pattern.replace(/[/\\]$/, '')
							return `${cleanPattern}/**/*`
						}
						return pattern
					}
					catch {
						return pattern
					}
				}),
			)
		}

		const positionalArgs = argv._.map(String)
		const rawIncludePatterns = [...positionalArgs, ...argv.include]

		// Validate glob patterns for basic syntax errors
		for (const pattern of rawIncludePatterns) {
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

		let includes: string[]

		if (rawIncludePatterns.length > 0)
			includes = await expandDirectoryPatterns(rawIncludePatterns)
		else
			includes = ['**/*']

		const binaryIgnorePattern = `**/*.{${BINARY_FILE_EXTENSIONS.join(',')}}`
		const excludes = [...DEFAULT_EXCLUDE_PATTERNS, binaryIgnorePattern, ...argv.exclude]

		const config = new YankConfig({
			clip: argv.clip,
			include: includes,
			exclude: excludes,
			fileTemplate: argv.fileTemplate,
			codeTemplate: argv.codeTemplate,
			stats: argv.stats || argv.tokens,
			tokens: argv.tokens,
			debug: argv.debug,
			langMap: argv.langMap,
		})

		if (!config.fileTemplate.includes('{filePath}')) {
			throw new Error(
				'Configuration error: --file-template must include the {filePath} placeholder.',
			)
		}
		if (!config.codeTemplate.includes('{content}')) {
			throw new Error(
				'Configuration error: --code-template must include the {content} placeholder.',
			)
		}

		return config
	}
}
