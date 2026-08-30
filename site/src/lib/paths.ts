import fs from 'node:fs';
import path from 'node:path';

/**
 * Locate the repository root (the directory containing json/universities).
 *
 * Deliberately based on the working directory rather than import.meta.url:
 * Astro bundles this module into the build output at a depth that depends on
 * the configured outDir, so URL-relative resolution is not stable. Both
 * `astro build` and vitest run with site/ (or the repo root) as cwd.
 */
function findRepoRoot(): string {
	let dir = process.env.TARGYGRAF_ROOT || process.cwd();
	for (let i = 0; i < 6; i++) {
		if (fs.existsSync(path.join(dir, 'json', 'universities'))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
	throw new Error(
		'Could not locate the repository root (json/universities). ' +
			'Run from within the repository or set TARGYGRAF_ROOT.'
	);
}

export const REPO_ROOT = findRepoRoot();

export const JSON_ROOT = path.join(REPO_ROOT, 'json');
