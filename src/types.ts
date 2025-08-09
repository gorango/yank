export interface ProcessedFile {
	relPath: string
	content: string
	lineCount: number
}

export interface YankConfigCtor {
	clip: boolean
	include: string[]
	exclude: string[]
	fileTemplate: string
	codeTemplate: string
	stats: boolean
	tokens: boolean
	debug: boolean
}
