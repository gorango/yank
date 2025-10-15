export interface ProcessedFile {
	relPath: string
	content: string
	lineCount: number
}

export interface FileProcessingStats {
	totalFiles: number
	processedFiles: number
	skippedFiles: number
	skippedReasons: Map<string, number>
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
	preview: boolean
	langMap?: Record<string, string>
}
