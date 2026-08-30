import { describe, expect, it } from 'vitest';

import { route } from '../worker/routing';

const UNIVERSITIES = ['bme', 'pe', 'pte'];
const BASE = 'targygraf.hu';

function decide(url: string) {
	return route(new URL(url), BASE, UNIVERSITIES);
}

describe('worker routing: apex domain', () => {
	it('passes apex requests straight to the asset layer', () => {
		expect(decide('https://targygraf.hu/')).toEqual({ kind: 'serve', assetPath: '/' });
		expect(decide('https://targygraf.hu/pe')).toEqual({ kind: 'serve', assetPath: '/pe' });
		expect(decide('https://targygraf.hu/pe/mernokinformatikus')).toEqual({
			kind: 'serve',
			assetPath: '/pe/mernokinformatikus',
		});
		expect(decide('https://targygraf.hu/nem-letezik')).toEqual({
			kind: 'serve',
			assetPath: '/nem-letezik',
		});
	});
});

describe('worker routing: legacy subdomain redirects', () => {
	it('redirects the university root to the apex path', () => {
		expect(decide('https://pe.targygraf.hu/')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe',
		});
	});

	it('redirects program URLs to nested apex paths', () => {
		expect(decide('https://pe.targygraf.hu/mernokinformatikus')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe/mernokinformatikus',
		});
		expect(decide('https://bme.targygraf.hu/jarmumernok')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/bme/jarmumernok',
		});
	});

	it('redirects www and unknown subdomains to the same apex path', () => {
		expect(decide('https://www.targygraf.hu/')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/',
		});
		expect(decide('https://www.targygraf.hu/pe/mernokinformatikus')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe/mernokinformatikus',
		});
		expect(decide('https://nincsilyen.targygraf.hu/valami')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/valami',
		});
	});

	it('normalizes trailing slashes while redirecting', () => {
		expect(decide('https://pe.targygraf.hu/mernokinformatikus/')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe/mernokinformatikus',
		});
	});

	it('preserves query strings', () => {
		expect(decide('https://pe.targygraf.hu/mernokinformatikus?fbclid=abc')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe/mernokinformatikus?fbclid=abc',
		});
	});

	it('is case-insensitive on hostnames', () => {
		expect(decide('https://PE.targygraf.hu/x')).toEqual({
			kind: 'redirect',
			location: 'https://targygraf.hu/pe/x',
		});
	});
});

describe('worker routing: host-independent statics', () => {
	it('keeps serving shared static files on the legacy origins', () => {
		expect(decide('https://pe.targygraf.hu/assets/js/targygraf.js?v=20190625')).toEqual({
			kind: 'serve',
			assetPath: '/assets/js/targygraf.js',
		});
		expect(decide('https://pe.targygraf.hu/icon.png')).toEqual({
			kind: 'serve',
			assetPath: '/icon.png',
		});
		expect(decide('https://pe.targygraf.hu/og.png')).toEqual({
			kind: 'serve',
			assetPath: '/og.png',
		});
		expect(decide('https://pe.targygraf.hu/favicon.svg')).toEqual({
			kind: 'serve',
			assetPath: '/favicon.svg',
		});
	});

	it('keeps serving /__migrate on the legacy origins', () => {
		expect(decide('https://pe.targygraf.hu/__migrate')).toEqual({
			kind: 'serve',
			assetPath: '/__migrate',
		});
	});
});

describe('worker routing: previews and local dev', () => {
	it('serves foreign hosts as-is', () => {
		expect(decide('https://targygraf.example.workers.dev/pe/mernokinformatikus')).toEqual({
			kind: 'serve',
			assetPath: '/pe/mernokinformatikus',
		});
		expect(decide('http://localhost:8787/pe')).toEqual({ kind: 'serve', assetPath: '/pe' });
	});
});

describe('worker routing: generated university list', () => {
	it('matches json/universities', async () => {
		const fs = await import('node:fs');
		const path = await import('node:path');
		const { JSON_ROOT } = await import('../src/lib/paths');
		const generated = JSON.parse(
			fs.readFileSync(
				new URL('../worker/universities.generated.json', import.meta.url),
				'utf8'
			)
		);
		const expected = fs
			.readdirSync(path.join(JSON_ROOT, 'universities'))
			.filter((f: string) => f[0] !== '.' && f.endsWith('.json'))
			.map((f: string) => f.replace(/\.json$/, ''))
			.sort();
		expect(generated).toEqual(expected);
	});
});
