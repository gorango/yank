/* eslint-disable antfu/consistent-list-newline */

export const BINARY_FILE_EXTENSIONS: string[] = [
	// Archives & Compressed
	'7z', 'a', 'apk', 'ar', 'bz2', 'cab', 'cpio', 'deb', 'dmg', 'gz', 'iso', 'jar', 'lz', 'lz4', 'lzma', 'nupkg', 'rar', 'rpm', 'tar', 'taz', 'tbz', 'tbz2', 'tgz', 'tlz', 'txz', 'xz', 'z', 'zip', 'zst',
	// Images
	'ai', 'bmp', 'gif', 'heic', 'ico', 'icns', 'jpeg', 'jpg', 'png', 'psd', 'svgz', 'tif', 'tiff', 'webp',
	// Video
	'avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv',
	// Audio
	'aac', 'aiff', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav', 'wma',
	// Documents
	'doc', 'docx', 'dotx', 'epub', 'mobi', 'odt', 'pdf', 'ppt', 'pptx', 'rtf', 'xls', 'xlsx',
	// Other
	'bin', 'class', 'core', 'dat', 'db', 'dll', 'dylib', 'eot', 'exe', 'lock', 'o', 'obj', 'pak', 'pdb', 'so', 'sqlite', 'swp', 'swo', 'ttf', 'woff', 'woff2',
]

export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
	// Version control
	'.git/**',
	// Common directories
	'.next/**', 'node_modules/**', 'vendor/**', 'dist/**', 'build/**', 'out/**', 'target/**', 'bin/**', 'obj/**',
	// IDE/Editor folders
	'.idea/**', '.vscode/**', '.vs/**', '.settings/**',
	// Language-specific build/cache
	'.gradle/**', '.mvn/**', '.pytest_cache/**', '__pycache__/**', '.sass-cache/**',
	// Cloud/Deployment
	'.vercel/**', '.turbo/**',
	// Test & Coverage
	'coverage/**', 'test-results/**',
	// Lock files
	'.gitignore', 'pnpm-lock.yaml', 'yank.toml', 'package-lock.json', 'yarn.lock', 'Cargo.lock', 'Gemfile.lock', 'composer.lock', 'mix.lock', 'poetry.lock', 'Pipfile.lock',
	// Common file types
	'*.pyc', '*.pyo', '*.pyd', '*.log', '*.tmp', '*.temp', '*.bak', '*~',
	// OS-specific
	'.DS_Store', 'Thumbs.db',
	// Secrets
	'.env*',
]
