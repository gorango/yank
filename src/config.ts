import type { YankConfigCtor } from './types.js'
import fs from 'node:fs/promises'
import process from 'node:process'
import { cosmiconfig } from 'cosmiconfig'
import { loadToml } from 'cosmiconfig-toml-loader'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { BINARY_FILE_EXTENSIONS, DEFAULT_EXCLUDE_PATTERNS } from './defaults.js'

const moduleName = 'yank'

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
	readonly include: string[]
	readonly exclude: string[]
	readonly clip: boolean
	readonly fileTemplate: string
	readonly codeTemplate: string
	readonly stats: boolean
	readonly debug: boolean

	private constructor(init: YankConfigCtor) {
		this.include = init.include
		this.exclude = init.exclude
		this.clip = init.clip
		this.fileTemplate = init.fileTemplate
		this.codeTemplate = init.codeTemplate
		this.stats = init.stats
		this.debug = init.debug
	}

	public static async init(): Promise<YankConfig> {
		const preParse = yargs(hideBin(process.argv))
			.option('config', {
				alias: 'C',
				type: 'string',
				describe: 'Path to a custom configuration file.',
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
			.option('include', {
				alias: 'i',
				type: 'array',
				string: true,
				description: 'Glob patterns for files to include.',
				default: ['**/*'],
			})
			.option('exclude', {
				alias: 'x',
				type: 'array',
				string: true,
				description: 'Glob patterns to exclude files (appended to defaults).',
				default: [],
			})
			.option('clip', {
				alias: 'c',
				type: 'boolean',
				description: 'Send output directly to the system clipboard.',
				default: false,
			})
			.option('stats', {
				alias: 's',
				type: 'boolean',
				description: 'Print summary statistics to stderr.',
				default: false,
			})
			.option('file-template', {
				alias: 'H',
				type: 'string',
				description: 'Template for the file header. Placeholders: {filePath}',
				default: '--- {filePath} ---',
			})
			.option('code-template', {
				alias: 'B',
				type: 'string',
				description: 'Template for the code block. Placeholders: {language}, {content}',
				default: '```{language}\n{content}\n```',
			})
			.option('debug', {
				type: 'boolean',
				description: 'Enable debug output.',
				default: false,
			})
			.option('config', {
				alias: 'C',
				type: 'string',
				description: 'Path to a custom configuration file.',
			})
			.config(fileConfig)
			.help()
			.alias('h', 'help')
			.version(appVersion)
			.alias('v', 'version')
			.parse()

		const positionalArgs = argv._.map(String)
		let includes: string[]

		if (positionalArgs.length > 0) {
			includes = await Promise.all(
				positionalArgs.map(async (arg) => {
					try {
						const stats = await fs.stat(arg)
						if (stats.isDirectory()) {
							const cleanArg = arg.replace(/[/\\]$/, '')
							return `${cleanArg}/**/*`
						}
						else {
							return arg
						}
					}
					catch {
						return arg
					}
				}),
			)
		}

		else {
			includes = argv.include
		}

		const binaryIgnorePattern = `**/*.{${BINARY_FILE_EXTENSIONS.join(',')}}`
		const excludes = [...DEFAULT_EXCLUDE_PATTERNS, binaryIgnorePattern, ...argv.exclude]

		const config = new YankConfig({
			include: includes,
			exclude: excludes,
			clip: argv.clip,
			fileTemplate: argv.fileTemplate,
			codeTemplate: argv.codeTemplate,
			stats: argv.stats,
			debug: argv.debug,
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
