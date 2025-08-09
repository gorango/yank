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
}

export function getLanguage(filePath: string): string {
	const filename = filePath.split('/').pop() ?? ''

	if (languageMap[filename])
		return languageMap[filename]

	const extension = filename.split('.').pop()?.toLowerCase() ?? ''
	return languageMap[extension] ?? '' // empty string for unknown languages
}
