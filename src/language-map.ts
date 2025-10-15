import fs from 'node:fs/promises'
import path from 'node:path'

export const languageMap: Record<string, string> = {
	// Web
	ts: 'typescript',
	js: 'javascript',
	tsx: 'tsx',
	jsx: 'jsx',
	html: 'html',
	css: 'css',
	scss: 'scss',
	less: 'less',
	json: 'json',
	md: 'markdown',
	mdx: 'mdx',
	yaml: 'yaml',
	yml: 'yaml',
	toml: 'toml',
	xml: 'xml',
	svg: 'xml',
	svelte: 'svelte',
	vue: 'vue',

	// Backend & Systems
	py: 'python',
	rb: 'ruby',
	go: 'go',
	rs: 'rust',
	php: 'php',
	java: 'java',
	kt: 'kotlin',
	kts: 'kotlin',
	cs: 'csharp',
	fs: 'fsharp',
	cpp: 'cpp',
	c: 'c',
	h: 'c',
	hpp: 'cpp',
	lua: 'lua',
	pl: 'perl',
	swift: 'swift',
	scala: 'scala',
	ex: 'elixir',
	exs: 'elixir',
	cr: 'crystal',

	// Shell & Config
	sh: 'shell',
	bash: 'bash',
	zsh: 'zsh',
	fish: 'fish',
	ps1: 'powershell',
	Dockerfile: 'dockerfile',
	dockerfile: 'dockerfile',
	tf: 'terraform',
	hcl: 'hcl',
	nginx: 'nginx',
	conf: 'ini',
	ini: 'ini',

	// SQL & Data
	sql: 'sql',
	graphql: 'graphql',
	gql: 'graphql',

	// Other
	r: 'r',
	dart: 'dart',
	hs: 'haskell',
	erl: 'erlang',
	clj: 'clojure',
	elm: 'elm',

	// Additional mappings for case-insensitive extensions and common files
	Makefile: 'makefile',
	makefile: 'makefile',
	Jenkinsfile: 'groovy',
	R: 'r',
	env: 'ini',
	'.env': 'ini',
}

export async function getLanguage(filePath: string): Promise<string> {
	const filename = path.basename(filePath)

	if (languageMap[filename]) return languageMap[filename]

	const extension = path.extname(filename).slice(1).toLowerCase()

	if (extension && languageMap[extension]) return languageMap[extension]

	if (!extension) {
		try {
			const content = await fs.readFile(filePath, 'utf-8')
			const firstLine = content.split('\n')[0]?.trim()

			if (firstLine?.startsWith('#!')) {
				if (firstLine.includes('bash') || firstLine.includes('sh')) return 'bash'
				if (firstLine.includes('python') || firstLine.includes('python3')) return 'python'
				if (firstLine.includes('node') || firstLine.includes('nodejs')) return 'javascript'
				if (firstLine.includes('ruby')) return 'ruby'
				if (firstLine.includes('perl')) return 'perl'
				if (firstLine.includes('php')) return 'php'
				if (firstLine.includes('lua')) return 'lua'
				if (firstLine.includes('fish')) return 'fish'
				if (firstLine.includes('zsh')) return 'zsh'
				if (firstLine.includes('powershell') || firstLine.includes('pwsh')) return 'powershell'
				if (firstLine.includes('deno')) return 'typescript'
				if (firstLine.includes('bun')) return 'javascript'
			}
		} catch {
			// file can't be read
		}
	}

	return '' // empty string for unknown languages
}
