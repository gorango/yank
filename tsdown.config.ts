import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/main.ts'],
	format: ['esm'],
	clean: true,
	minify: true,
	banner: {
		js: '#!/usr/bin/env node\nprocess.env.__YANK_CLI__ = "1"',
	},
})
