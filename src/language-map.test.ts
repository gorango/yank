import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getLanguage } from './language-map'

describe('getLanguage', () => {
	it('should return the correct language for a standard extension', async () => {
		expect(await getLanguage('src/components/button.tsx')).toBe('tsx')
		expect(await getLanguage('src/main.rs')).toBe('rust')
	})

	it('should return the correct language for a special filename like Dockerfile', async () => {
		expect(await getLanguage('Dockerfile')).toBe('dockerfile')
		expect(await getLanguage('scripts/Dockerfile.dev')).toBe('')
	})

	it('should return an empty string for an unknown extension', async () => {
		expect(await getLanguage('assets/image.jpeg')).toBe('')
	})

	it('should handle complex paths correctly', async () => {
		expect(await getLanguage('a/b/c/d.min.js')).toBe('javascript')
	})

	it('should handle case-insensitive extensions', async () => {
		expect(await getLanguage('script.R')).toBe('r')
		expect(await getLanguage('data.CSV')).toBe('')
	})

	it('should detect shebang for bash scripts', async () => {
		const tempDir = os.tmpdir()
		const scriptPath = path.join(tempDir, 'test-script')

		try {
			await fs.writeFile(scriptPath, '#!/bin/bash\necho "Hello World"')
			expect(await getLanguage(scriptPath)).toBe('bash')
		}
		finally {
			try {
				await fs.unlink(scriptPath)
			}
			catch {}
		}
	})

	it('should detect shebang for python scripts', async () => {
		const tempDir = os.tmpdir()
		const scriptPath = path.join(tempDir, 'test-script')

		try {
			await fs.writeFile(scriptPath, '#!/usr/bin/env python3\nprint("Hello World")')
			expect(await getLanguage(scriptPath)).toBe('python')
		}
		finally {
			try {
				await fs.unlink(scriptPath)
			}
			catch {}
		}
	})

 	it('should detect shebang for node scripts', async () => {
 		const tempDir = os.tmpdir()
 		const scriptPath = path.join(tempDir, 'test-script')

 		try {
 			await fs.writeFile(scriptPath, '#!/usr/bin/node\nconsole.log("Hello World")')
 			expect(await getLanguage(scriptPath)).toBe('javascript')
 		}
 		finally {
 			try {
 				await fs.unlink(scriptPath)
 			}
 			catch {}
 		}
 	})

 	it('should detect shebang for deno scripts', async () => {
 		const tempDir = os.tmpdir()
 		const scriptPath = path.join(tempDir, 'test-script')

 		try {
 			await fs.writeFile(scriptPath, '#!/usr/bin/env deno\nconsole.log("Hello World")')
 			expect(await getLanguage(scriptPath)).toBe('typescript')
 		}
 		finally {
 			try {
 				await fs.unlink(scriptPath)
 			}
 			catch {}
 		}
 	})

 	it('should detect shebang for bun scripts', async () => {
 		const tempDir = os.tmpdir()
 		const scriptPath = path.join(tempDir, 'test-script')

 		try {
 			await fs.writeFile(scriptPath, '#!/usr/bin/env bun\nconsole.log("Hello World")')
 			expect(await getLanguage(scriptPath)).toBe('javascript')
 		}
 		finally {
 			try {
 				await fs.unlink(scriptPath)
 			}
 			catch {}
 		}
 	})

	it('should handle files with no extension and no shebang', async () => {
		const tempDir = os.tmpdir()
		const scriptPath = path.join(tempDir, 'test-file')

		try {
			await fs.writeFile(scriptPath, 'This is just text content')
			expect(await getLanguage(scriptPath)).toBe('')
		}
		finally {
			try {
				await fs.unlink(scriptPath)
			}
			catch {}
		}
	})

	it('should handle Makefile detection', async () => {
		expect(await getLanguage('Makefile')).toBe('makefile')
		expect(await getLanguage('makefile')).toBe('makefile')
	})

	it('should handle .env file detection', async () => {
		expect(await getLanguage('.env')).toBe('ini')
		expect(await getLanguage('config.env')).toBe('ini')
	})

	it('should handle Jenkinsfile detection', async () => {
		expect(await getLanguage('Jenkinsfile')).toBe('groovy')
	})
})
