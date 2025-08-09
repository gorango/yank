import { describe, expect, it } from 'vitest'
import { getLanguage } from './language-map'

describe('getLanguage', () => {
	it('should return the correct language for a standard extension', () => {
		expect(getLanguage('src/components/button.tsx')).toBe('tsx')
		expect(getLanguage('src/main.rs')).toBe('rust')
	})

	it('should return the correct language for a special filename like Dockerfile', () => {
		expect(getLanguage('Dockerfile')).toBe('dockerfile')
		expect(getLanguage('scripts/Dockerfile.dev')).toBe('')
	})

	it('should return an empty string for an unknown extension', () => {
		expect(getLanguage('assets/image.jpeg')).toBe('')
	})

	it('should return an empty string for a file with no extension', () => {
		expect(getLanguage('LICENSE')).toBe('')
	})

	it('should handle complex paths correctly', () => {
		expect(getLanguage('a/b/c/d.min.js')).toBe('javascript')
	})
})
