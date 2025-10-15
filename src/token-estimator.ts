export function estimateTokens(text: string): number {
	const words = text.split(/\s+/).filter(Boolean)
	let tokenCount = 0
	const specialCharRegex = /[.,;:!?(){}[\]<>=\-+*/\\|"'`@#$%^&~]/g

	for (const word of words) {
		const specialChars = (word.match(specialCharRegex) || []).length
		tokenCount += specialChars

		const cleanWord = word.replace(specialCharRegex, '')
		if (!cleanWord) continue

		const len = cleanWord.length
		if (len < 5) {
			tokenCount += 1
		} else if (len <= 10) {
			tokenCount += 1.2 // approximate subword splitting
		} else {
			tokenCount += 1.5 // long words get split into more tokens
		}
	}

	const newlineCount = (text.match(/\n/g) || []).length
	tokenCount += newlineCount

	return Math.round(tokenCount)
}
