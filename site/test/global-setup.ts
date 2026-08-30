/**
 * Builds the site twice (path mode and subdomain mode) into dist-test/ so the
 * build output tests can inspect real generated HTML. Skipped when
 * SKIP_BUILD_TESTS=1 (the affected suites skip themselves too).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DIST_PATH_MODE = path.join(SITE_ROOT, 'dist-test', 'path');
export const DIST_SUBDOMAIN_MODE = path.join(SITE_ROOT, 'dist-test', 'subdomain');

function build(outDir: string, urlMode: string) {
	execFileSync('npx', ['astro', 'build'], {
		cwd: SITE_ROOT,
		stdio: 'inherit',
		env: {
			...process.env,
			OUT_DIR: outDir,
			URL_MODE: urlMode,
			SITE_DOMAIN: 'targygraf.hu',
		},
	});
}

export default function setup() {
	if (process.env.SKIP_BUILD_TESTS === '1') {
		return;
	}
	build(DIST_PATH_MODE, 'path');
	build(DIST_SUBDOMAIN_MODE, 'subdomain');
}
