/**
 * Builds the site into dist-test/ so the output tests can inspect real
 * generated HTML. Skipped when SKIP_BUILD_TESTS=1 (the affected suites skip
 * themselves too).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DIST = path.join(REPO_ROOT, 'dist-test', 'site');

export default function setup() {
	if (process.env.SKIP_BUILD_TESTS === '1') {
		return;
	}
	const astroBin = path.join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
	execFileSync(process.execPath, [astroBin, 'build'], {
		cwd: REPO_ROOT,
		stdio: 'inherit',
		env: {
			...process.env,
			OUT_DIR: DIST,
			SITE_ORIGIN: 'https://targygraf.hu',
		},
	});
}
