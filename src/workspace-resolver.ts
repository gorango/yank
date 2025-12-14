import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'

export interface WorkspaceInfo {
	root: string
	packages: Map<string, string> // name -> dir
}

/**
 * Finds the workspace root by searching upwards for pnpm-workspace.yaml or package.json with workspaces.
 */
export async function findWorkspaceRoot(startDir: string): Promise<string | null> {
	let current = path.resolve(startDir)
	const root = path.parse(current).root

	while (current !== root) {
		try {
			await fs.access(path.join(current, 'pnpm-workspace.yaml'))
			return current
		} catch {}

		try {
			const pkgPath = path.join(current, 'package.json')
			const pkgContent = await fs.readFile(pkgPath, 'utf-8')
			const pkg = JSON.parse(pkgContent)
			if (pkg.workspaces) {
				return current
			}
		} catch {}

		current = path.dirname(current)
	}

	return null
}

/**
 * Gets all workspace packages as a map of name to directory.
 */
export async function getWorkspacePackages(root: string): Promise<Map<string, string>> {
	const packages = new Map<string, string>()

	// Try pnpm first
	try {
		const wsPath = path.join(root, 'pnpm-workspace.yaml')
		const content = await fs.readFile(wsPath, 'utf-8')
		const config = JSON.parse(content) // assuming YAML is JSON-like, or use a parser, but for simplicity
		if (config.packages) {
			for (const pattern of config.packages) {
				const dirs = await fg(pattern, { cwd: root, onlyDirectories: true, absolute: true })
				for (const dir of dirs) {
					try {
						const pkgPath = path.join(dir, 'package.json')
						const pkgContent = await fs.readFile(pkgPath, 'utf-8')
						const pkg = JSON.parse(pkgContent)
						if (pkg.name) {
							packages.set(pkg.name, path.relative(root, dir))
						}
					} catch {}
				}
			}
		}
	} catch {}

	// Fallback to npm/bun
	if (packages.size === 0) {
		try {
			const pkgPath = path.join(root, 'package.json')
			const pkgContent = await fs.readFile(pkgPath, 'utf-8')
			const pkg = JSON.parse(pkgContent)
			if (pkg.workspaces) {
				const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || []
				for (const pattern of patterns) {
					const dirs = await fg(pattern, { cwd: root, onlyDirectories: true, absolute: true })
					for (const dir of dirs) {
						try {
							const pkgPath = path.join(dir, 'package.json')
							const pkgContent = await fs.readFile(pkgPath, 'utf-8')
							const pkg = JSON.parse(pkgContent)
							if (pkg.name) {
								packages.set(pkg.name, path.relative(root, dir))
							}
						} catch {}
					}
				}
			}
		} catch {}
	}

	return packages
}

/**
 * Resolves workspace dependencies recursively, returning a set of relative directories.
 */
export async function resolveWorkspaceDeps(
	packagePath: string,
	packages: Map<string, string>,
	root: string,
	visited = new Set<string>(),
): Promise<Set<string>> {
	const deps = new Set<string>()

	try {
		const pkgPath = path.join(root, packagePath, 'package.json')
		const pkgContent = await fs.readFile(pkgPath, 'utf-8')
		const pkg = JSON.parse(pkgContent)

		const allDeps = {
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.peerDependencies,
			...pkg.optionalDependencies,
		}

		for (const [dep, version] of Object.entries(allDeps)) {
			if (typeof version === 'string' && version.startsWith('workspace:')) {
				if (visited.has(dep)) continue // cycle
				visited.add(dep)

				const depDir = packages.get(dep)
				if (!depDir) {
					throw new Error(`Unresolved workspace dependency: ${dep}`)
				}

				deps.add(depDir)
				// Recursive
				const subDeps = await resolveWorkspaceDeps(depDir, packages, root, visited)
				for (const sub of subDeps) {
					deps.add(sub)
				}
			}
		}
	} catch (error) {
		throw new Error(
			`Failed to resolve workspace deps for ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}

	return deps
}
