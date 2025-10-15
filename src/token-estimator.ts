// src/token-estimator.ts
export function estimateTokens(text: string): number {
	// Split by whitespace and filter out empty strings
	const words = text.split(/\s+/).filter(Boolean)
	let tokenCount = 0

	// Punctuation and special characters regex
	const specialCharRegex = /[.,;:!?(){}[\]<>=\-+*/\\|"'`@#$%^&~]/g

	for (const word of words) {
		// Count special characters as individual tokens
		const specialChars = (word.match(specialCharRegex) || []).length
		tokenCount += specialChars

		// Remove special chars to get clean word for length-based estimation
		const cleanWord = word.replace(specialCharRegex, '')
		if (!cleanWord)
			continue // Skip if only special chars

		// Estimate tokens based on word length
		const len = cleanWord.length
		if (len < 5) {
			tokenCount += 1
		}
		else if (len <= 10) {
			tokenCount += 1.2 // Approximate subword splitting
		}
		else {
			tokenCount += 1.5 // Long words may split into more tokens
		}
	}

	// Count newlines as tokens
	const newlineCount = (text.match(/\n/g) || []).length
	tokenCount += newlineCount

	return Math.round(tokenCount)
}
