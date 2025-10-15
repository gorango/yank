import { describe, expect, it } from 'vitest'
import { estimateTokens } from './token-estimator'

describe('estimateTokens', () => {
	it('counts simple text accurately', () => {
		const text = 'Hello world!\nThis is a test.'
		const tokens = estimateTokens(text)
		// Expected: ~9 tokens (Hello, world, !, \n, This, is, a, test, .)
		expect(tokens).toBeGreaterThanOrEqual(8)
		expect(tokens).toBeLessThanOrEqual(10)
	})

	it('handles code with special characters', () => {
		const text = 'function add(a: number, b: number) {\n  return a + b;\n}'
		const tokens = estimateTokens(text)
		// Expected: ~20 tokens (function, add, (, a, :, number, ,, b, :, number, ), {, \n, return, a, +, b, ;, \n, })
		expect(tokens).toBeGreaterThanOrEqual(18)
		expect(tokens).toBeLessThanOrEqual(22)
	})

	it('counts newlines correctly', () => {
		const text = 'Line 1\nLine 2\nLine 3'
		const tokens = estimateTokens(text)
		// Expected: ~8 tokens (Line, 1, \n, Line, 2, \n, Line, 3)
		expect(tokens).toBeGreaterThanOrEqual(7)
		expect(tokens).toBeLessThanOrEqual(10)
	})

	it('handles empty input', () => {
		const tokens = estimateTokens('')
		expect(tokens).toBe(0)
	})

	it('handles text with only special characters', () => {
		const text = '!@#$%^&*()'
		const tokens = estimateTokens(text)
		// Should count each special character as a token
		expect(tokens).toBe(10)
	})

	it('handles long words correctly', () => {
		const text = 'supercalifragilisticexpialidocious'
		const tokens = estimateTokens(text)
		// Long word should get 1.5 tokens due to length
		expect(tokens).toBe(2) // rounded up from 1.5
	})

	it('handles medium length words correctly', () => {
		const text = 'hello world'
		const tokens = estimateTokens(text)
		// Each word < 5 chars gets 1 token, space is ignored
		expect(tokens).toBe(2)
	})

	it('handles mixed content with code and comments', () => {
		const text =
			'// This is a comment\nfunction calculateTotal(items: Item[]): number {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}'
		const tokens = estimateTokens(text)
		// Should handle code keywords, identifiers, punctuation, and newlines
		expect(tokens).toBeGreaterThanOrEqual(35)
		expect(tokens).toBeLessThanOrEqual(45)
	})
})
