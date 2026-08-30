/**
 * End-to-end test of the deployed artifact: the wrangler-bundled Worker plus
 * the real build output served through Miniflare (workerd) with the same
 * asset configuration as wrangler.jsonc. Unlike `wrangler dev`, Miniflare's
 * dispatchFetch accepts arbitrary hostnames, so the legacy subdomain
 * redirects can be exercised for real.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DIST } from './global-setup';

const skip = process.env.SKIP_BUILD_TESTS === '1';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_DIR = path.join(REPO_ROOT, 'dist-test', 'worker-bundle');

describe.skipIf(skip)('worker + assets end-to-end (Miniflare)', () => {
	let mf: Miniflare;

	beforeAll(async () => {
		// wrangler validates assets.directory (./dist) even for a dry-run
		// bundle; the suite itself serves DIST, so an empty dist/ suffices.
		fs.mkdirSync(path.join(REPO_ROOT, 'dist'), { recursive: true });
		// Bundle the worker exactly as a deploy would.
		execFileSync(
			process.execPath,
			[
				path.join(REPO_ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
				'deploy',
				'--dry-run',
				'--outdir',
				BUNDLE_DIR,
			],
			{ cwd: REPO_ROOT, stdio: 'pipe' }
		);
		const bundled = fs
			.readdirSync(BUNDLE_DIR)
			.find((file) => file.endsWith('.js') && !file.endsWith('.map.js'));

		mf = new Miniflare({
			workers: [
				{
					name: 'targygraf',
					modules: true,
					scriptPath: path.join(BUNDLE_DIR, bundled!),
					compatibilityDate: '2026-08-01',
					bindings: { BASE_DOMAIN: 'targygraf.hu' },
					assets: {
						directory: DIST,
						binding: 'ASSETS',
						// Mirror wrangler.jsonc's run_worker_first globs (Miniflare's
						// direct API takes them as static_routing).
						routerConfig: {
							has_user_worker: true,
							static_routing: {
								user_worker: ['/*'],
								asset_worker: [
									'/assets/*',
									'/icon.png',
									'/favicon.ico',
									'/robots.txt',
									'/sitemap.xml',
								],
							},
						},
						assetConfig: {
							html_handling: 'auto-trailing-slash',
							not_found_handling: '404-page',
						},
					},
				},
			],
		});
		await mf.ready;
	}, 120_000);

	afterAll(async () => {
		await mf?.dispose();
	});

	async function get(url: string) {
		return mf.dispatchFetch(url, { redirect: 'manual' });
	}

	it('serves the home page on the apex', async () => {
		const res = await get('https://targygraf.hu/');
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('<title>Tárgygráf</title>');
	});

	it('serves university and program pages on apex paths', async () => {
		const uni = await get('https://targygraf.hu/pe');
		expect(uni.status).toBe(200);
		expect(await uni.text()).toContain('<title>Pannon Egyetem | Tárgygráf</title>');

		const program = await get('https://targygraf.hu/pe/mernokinformatikus');
		expect(program.status).toBe(200);
		expect(await program.text()).toContain('data-code="VEMIMAB346MA"');
	});

	it('301-redirects legacy subdomain URLs to apex paths', async () => {
		const root = await get('https://pe.targygraf.hu/');
		expect(root.status).toBe(301);
		expect(root.headers.get('location')).toBe('https://targygraf.hu/pe');

		const program = await get('https://pe.targygraf.hu/mernokinformatikus');
		expect(program.status).toBe(301);
		expect(program.headers.get('location')).toBe(
			'https://targygraf.hu/pe/mernokinformatikus'
		);
	});

	it('redirects www and unknown subdomains to the apex', async () => {
		const www = await get('https://www.targygraf.hu/pe');
		expect(www.status).toBe(301);
		expect(www.headers.get('location')).toBe('https://targygraf.hu/pe');

		const unknown = await get('https://nincsilyen.targygraf.hu/x');
		expect(unknown.status).toBe(301);
		expect(unknown.headers.get('location')).toBe('https://targygraf.hu/x');
	});

	it('keeps serving shared assets on legacy origins', async () => {
		const res = await get('https://pe.targygraf.hu/assets/js/targygraf.js');
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('coursesFinished');
	});

	it('normalizes trailing slashes', async () => {
		const apex = await get('https://targygraf.hu/pe/mernokinformatikus/');
		expect(apex.status).toBe(307); // asset layer auto-trailing-slash
		expect(new URL(apex.headers.get('location')!, 'https://targygraf.hu').pathname).toBe(
			'/pe/mernokinformatikus'
		);

		const legacy = await get('https://pe.targygraf.hu/mernokinformatikus/');
		expect(legacy.status).toBe(301);
		expect(legacy.headers.get('location')).toBe(
			'https://targygraf.hu/pe/mernokinformatikus'
		);
	});

	it('serves the 404 page with status 404 for unknown apex paths', async () => {
		const res = await get('https://targygraf.hu/nem-letezik');
		expect(res.status).toBe(404);
		expect(await res.text()).toContain('Az oldal nem található');
	});

	it('serves previews on foreign hosts with path URLs', async () => {
		const res = await get('https://targygraf.example.workers.dev/pe/mernokinformatikus');
		expect(res.status).toBe(200);
	});
});
