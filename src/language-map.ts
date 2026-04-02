import fs from 'node:fs/promises'
import path from 'node:path'

export const languageMap: Record<string, string> = {
	// Web
	ts: 'typescript',
	js: 'javascript',
	tsx: 'tsx',
	jsx: 'jsx',
	html: 'html',
	htm: 'html',
	css: 'css',
	scss: 'scss',
	less: 'less',
	json: 'json',
	jsonc: 'json',
	json5: 'json',
	md: 'markdown',
	mdx: 'mdx',
	yaml: 'yaml',
	yml: 'yaml',
	toml: 'toml',
	xml: 'xml',
	xsd: 'xml',
	xslt: 'xml',
	svg: 'xml',
	svelte: 'svelte',
	vue: 'vue',
	astro: 'astro',

	// Backend & Systems
	py: 'python',
	pyi: 'python',
	pyc: 'python',
	rb: 'ruby',
	rake: 'ruby',
	go: 'go',
	sum: 'go',
	rs: 'rust',
	php: 'php',
	php3: 'php',
	php4: 'php',
	php5: 'php',
	phtml: 'php',
	java: 'java',
	class: 'java',
	kt: 'kotlin',
	kts: 'kotlin',
	cs: 'csharp',
	fs: 'fsharp',
	fsx: 'fsharp',
	cpp: 'cpp',
	cc: 'cpp',
	cxx: 'cpp',
	c: 'c',
	h: 'c',
	hpp: 'cpp',
	hxx: 'cpp',
	lua: 'lua',
	pl: 'perl',
	pm: 'perl',
	swift: 'swift',
	scala: 'scala',
	sc: 'scala',
	ex: 'elixir',
	exs: 'elixir',
	cr: 'crystal',
	zig: 'zig',
	nim: 'nim',
	v: 'vlang',
	d: 'd',
	asm: 'assembly',
	s: 'assembly',
	wat: 'wasm',
	wasm: 'wasm',
	proto: 'protobuf',

	// Shell & Config
	sh: 'shell',
	bash: 'bash',
	zsh: 'zsh',
	fish: 'fish',
	ps1: 'powershell',
	psm1: 'powershell',
	psd1: 'powershell',
	Dockerfile: 'dockerfile',
	dockerfile: 'dockerfile',
	tf: 'terraform',
	tfvars: 'terraform',
	hcl: 'hcl',
	nginx: 'nginx',
	conf: 'ini',
	cfg: 'ini',
	ini: 'ini',
	properties: 'ini',

	// SQL & Data
	sql: 'sql',
	graphql: 'graphql',
	gql: 'graphql',
	csv: 'csv',

	// Other
	r: 'r',
	dart: 'dart',
	hs: 'haskell',
	lhs: 'haskell',
	erl: 'erlang',
	hrl: 'erlang',
	clj: 'clojure',
	cljc: 'clojure',
	cljs: 'clojure',
	elm: 'elm',
	ml: 'ocaml',
	mli: 'ocaml',
	vb: 'vbnet',
	groovy: 'groovy',
	gradle: 'groovy',
	jenkinsfile: 'groovy',
	jl: 'julia',
	m: 'matlab',
	pas: 'pascal',
	pro: 'prolog',
	tcl: 'tcl',
	coffee: 'coffeescript',
	lisp: 'lisp',
	lsp: 'lisp',
	scm: 'scheme',
	rkt: 'racket',
	f: 'fortran',
	f90: 'fortran',
	f95: 'fortran',
	f03: 'fortran',
	cob: 'cobol',
	cbl: 'cobol',
	abap: 'abap',
	sas: 'sas',
	stan: 'stan',
	tex: 'latex',
	latex: 'latex',
	bib: 'bibtex',
	diff: 'diff',
	patch: 'diff',
	shader: 'glsl',
	glsl: 'glsl',
	frag: 'glsl',
	vert: 'glsl',
	comp: 'glsl',

	// Additional mappings for case-insensitive extensions and common files
	Makefile: 'makefile',
	makefile: 'makefile',
	Jenkinsfile: 'groovy',
	R: 'r',
	env: 'dotenv',
	'.env': 'dotenv',
	LICENSE: 'text',
	license: 'text',
	CHANGELOG: 'markdown',
	changelog: 'markdown',
	README: 'markdown',
	readme: 'markdown',
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
				if (firstLine.includes('powershell') || firstLine.includes('pwsh'))
					return 'powershell'
				if (firstLine.includes('deno')) return 'typescript'
				if (firstLine.includes('bun')) return 'javascript'
			}
		} catch {
			// file can't be read
		}
	}

	return '' // empty string for unknown languages
}
