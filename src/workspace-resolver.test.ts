import type { PathLike } from 'node:fs'
import fs from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { findWorkspaceRoot, getWorkspacePackages, resolveWorkspaceDeps } from './workspace-resolver.js'

vi.mock(
	import('node:fs/promises'),
	async (importOriginal: () => Promise<{ default: typeof import('fs/promises') }>) => {
		const { default: original } = await importOriginal()
		return {
			default: {
				...original,
				readFile: vi.fn(),
				access: vi.fn(),
			},
		}
	},
)

vi.mock('fast-glob', () => ({
	default: vi.fn(),
}))

const mockFs = vi.mocked(fs)
const mockFg = vi.mocked((await import('fast-glob')).default)

describe('workspace-resolver', () => {
	describe('findWorkspaceRoot', () => {
		it('finds pnpm-workspace.yaml', async () => {
			mockFs.access.mockImplementation((p: PathLike) => {
				if (p === '/some/pnpm-workspace.yaml') return Promise.resolve()
				return Promise.reject()
			})
			const root = await findWorkspaceRoot('/some/path')
			expect(root).toBe('/some')
		})

		it('finds package.json with workspaces', async () => {
			mockFs.access.mockRejectedValue(new Error())
			// biome-ignore lint/suspicious/noExplicitAny: Parameter type is complex union in fs.readFile
			mockFs.readFile.mockImplementation((p: any) => {
				if (p === '/some/package.json') return Promise.resolve(JSON.stringify({ workspaces: ['packages/*'] }))
				return Promise.reject()
			})
			const root = await findWorkspaceRoot('/some/path')
			expect(root).toBe('/some')
		})

		it('returns null if not found', async () => {
			mockFs.access.mockRejectedValue(new Error())
			mockFs.readFile.mockRejectedValue(new Error())
			const root = await findWorkspaceRoot('/some/path')
			expect(root).toBeNull()
		})
	})

	describe('getWorkspacePackages', () => {
		it('parses pnpm-workspace.yaml', async () => {
			// biome-ignore lint/suspicious/noExplicitAny: Parameter type is complex union in fs.readFile
			mockFs.readFile.mockImplementation((p: any) => {
				if (p === '/root/pnpm-workspace.yaml') return Promise.resolve(JSON.stringify({ packages: ['packages/*'] }))
				if (p === '/root/packages/a/package.json') return Promise.resolve(JSON.stringify({ name: 'pkg-a' }))
				if (p === '/root/packages/b/package.json') return Promise.resolve(JSON.stringify({ name: 'pkg-b' }))
				return Promise.reject()
			})
			mockFg.mockResolvedValue(['/root/packages/a', '/root/packages/b'])

			const packages = await getWorkspacePackages('/root')
			expect(packages.get('pkg-a')).toBe('packages/a')
			expect(packages.get('pkg-b')).toBe('packages/b')
		})

		it('parses package.json workspaces', async () => {
			// biome-ignore lint/suspicious/noExplicitAny: Parameter type is complex union in fs.readFile
			mockFs.readFile.mockImplementation((p: any) => {
				if (p === '/root/pnpm-workspace.yaml') return Promise.reject()
				if (p === '/root/package.json') return Promise.resolve(JSON.stringify({ workspaces: ['packages/*'] }))
				if (p === '/root/packages/a/package.json') return Promise.resolve(JSON.stringify({ name: 'pkg-a' }))
				return Promise.reject()
			})
			mockFg.mockResolvedValue(['/root/packages/a'])

			const packages = await getWorkspacePackages('/root')
			expect(packages.get('pkg-a')).toBe('packages/a')
		})
	})

	describe('resolveWorkspaceDeps', () => {
		it('resolves direct deps', async () => {
			mockFs.readFile.mockResolvedValue(
				JSON.stringify({
					dependencies: { 'pkg-b': 'workspace:*' },
				}),
			)
			const packages = new Map([['pkg-b', 'packages/b']])

			const deps = await resolveWorkspaceDeps('packages/a', packages, '/root', false)
			expect(deps.has('packages/b')).toBe(true)
		})

		it('resolves recursive deps', async () => {
			mockFs.readFile
				.mockResolvedValueOnce(
					JSON.stringify({
						dependencies: { 'pkg-b': 'workspace:*' },
					}),
				)
				.mockResolvedValueOnce(
					JSON.stringify({
						dependencies: { 'pkg-c': 'workspace:*' },
					}),
				)
				.mockResolvedValue(JSON.stringify({}))
			const packages = new Map([
				['pkg-b', 'packages/b'],
				['pkg-c', 'packages/c'],
			])

			const deps = await resolveWorkspaceDeps('packages/a', packages, '/root', true)
			expect(deps.has('packages/b')).toBe(true)
			expect(deps.has('packages/c')).toBe(true)
		})

		it('resolves direct deps only when recursive=false', async () => {
			mockFs.readFile.mockResolvedValue(
				JSON.stringify({
					dependencies: { 'pkg-b': 'workspace:*' },
				}),
			)
			const packages = new Map([
				['pkg-b', 'packages/b'],
				['pkg-c', 'packages/c'],
			])

			const deps = await resolveWorkspaceDeps('packages/a', packages, '/root', false)
			expect(deps.has('packages/b')).toBe(true)
			expect(deps.has('packages/c')).toBe(false)
		})

		it('fails on unresolved dep', async () => {
			mockFs.readFile.mockResolvedValue(
				JSON.stringify({
					dependencies: { missing: 'workspace:*' },
				}),
			)
			const packages = new Map()

			await expect(resolveWorkspaceDeps('packages/a', packages, '/root', false)).rejects.toThrow(
				'Unresolved workspace dependency: missing',
			)
		})

		it('handles cycles', async () => {
			mockFs.readFile
				.mockResolvedValueOnce(
					JSON.stringify({
						dependencies: { 'pkg-b': 'workspace:*' },
					}),
				)
				.mockResolvedValue(
					JSON.stringify({
						dependencies: { 'pkg-a': 'workspace:*' },
					}),
				)
			const packages = new Map([
				['pkg-a', 'packages/a'],
				['pkg-b', 'packages/b'],
			])

			const deps = await resolveWorkspaceDeps('packages/a', packages, '/root', true)
			expect(deps.has('packages/b')).toBe(true)
			// Should not infinite loop
		})
	})
})
