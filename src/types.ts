export interface ProcessedFile {
	relPath: string
	content: string
}

export interface YankConfigCtor {
	include: string[]
	exclude: string[]
	clip: boolean
	fileTemplate: string
	codeTemplate: string
	stats: boolean
	debug: boolean
}
