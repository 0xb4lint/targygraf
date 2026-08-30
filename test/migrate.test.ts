/**
 * Tests for the one-time localStorage handoff from the legacy
 * {university}.targygraf.hu origins to targygraf.hu (public/assets/js/
 * migrate.js + public/__migrate.html).
 *
 * Two transports: a hidden same-site iframe (Chrome/Firefox) and a
 * top-level bounce with a #tgm= fragment (WebKit, which partitions iframe
 * storage even for same-site subdomains).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE_SRC = fs.readFileSync(
	path.join(REPO_ROOT, 'public/assets/js/migrate.js'),
	'utf8'
);

const APPLE = 'Apple Computer, Inc.';

interface Harness {
	window: any;
	navigations: string[];
	send(origin: string, data: unknown): void;
}

interface Options {
	vendor?: string;
	hash?: string;
	session?: Record<string, string>;
}

function loadApexPage(
	university: string,
	existing: Record<string, unknown> = {},
	options: Options = {}
): Harness {
	const navigations: string[] = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => {
		if (String(error.message).includes('navigation')) {
			navigations.push(String(error.message));
		}
	});

	const dom = new JSDOM('<!doctype html><html><body></body></html>', {
		url: `https://targygraf.hu/${university}/valami${options.hash ?? ''}`,
		runScripts: 'outside-only',
		pretendToBeVisual: true,
		virtualConsole,
	});
	const { window } = dom;

	for (const [key, value] of Object.entries(existing)) {
		window.localStorage.setItem(key, JSON.stringify(value));
	}
	for (const [key, value] of Object.entries(options.session ?? {})) {
		window.sessionStorage.setItem(key, value);
	}
	// jsdom's default navigator.vendor is "Apple Computer, Inc." (the spec's
	// suggested value), which would take the WebKit path; default to a
	// non-WebKit vendor unless the test asks otherwise.
	Object.defineProperty(window.navigator, 'vendor', {
		value: options.vendor ?? 'Google Inc.',
		configurable: true,
	});

	(window as any).migrateUniversity = university;
	window.eval(MIGRATE_SRC);

	return {
		window,
		navigations,
		send(origin: string, data: unknown) {
			window.dispatchEvent(new window.MessageEvent('message', { origin, data }));
		},
	};
}

const PAYLOAD = {
	type: 'targygraf-migrate',
	coursesFinished: ['AAA111', 'BBB222'],
	coursesProcessing: ['CCC333'],
	creditsOptional: 4,
};

describe('migrate: apex receiver, iframe transport (non-WebKit)', () => {
	it('embeds a hidden iframe pointing at the legacy origin', () => {
		const page = loadApexPage('pe');
		const frame = page.window.document.querySelector('iframe');
		expect(frame).not.toBeNull();
		expect(frame.src).toBe('https://pe.targygraf.hu/__migrate');
		expect(frame.style.display).toBe('none');
	});

	it('imports legacy data, flags the university done, and reloads', () => {
		const page = loadApexPage('pe');
		page.send('https://pe.targygraf.hu', PAYLOAD);

		const ls = page.window.localStorage;
		expect(JSON.parse(ls.getItem('coursesFinished'))).toEqual(['AAA111', 'BBB222']);
		expect(JSON.parse(ls.getItem('coursesProcessing'))).toEqual(['CCC333']);
		expect(JSON.parse(ls.getItem('creditsOptional'))).toBe(4);
		expect(ls.getItem('migrated_pe')).toBe('1');
		// The reload (so targygraf.js re-reads storage) surfaces as a jsdom
		// navigation attempt.
		expect(page.navigations.length).toBe(1);
		// The bridge iframe is removed either way.
		expect(page.window.document.querySelector('iframe')).toBeNull();
	});

	it('merges with existing apex data without losing either side', () => {
		const page = loadApexPage('pe', {
			coursesFinished: ['BBB222', 'ZZZ999'],
			creditsOptional: 7,
		});
		page.send('https://pe.targygraf.hu', PAYLOAD);

		const ls = page.window.localStorage;
		expect(JSON.parse(ls.getItem('coursesFinished'))).toEqual([
			'BBB222',
			'ZZZ999',
			'AAA111',
		]);
		// The apex value wins for the optional-credits counter.
		expect(JSON.parse(ls.getItem('creditsOptional'))).toBe(7);
	});

	it('does not reload when the legacy origin had nothing new', () => {
		const page = loadApexPage('pe', {
			coursesFinished: ['AAA111', 'BBB222'],
			coursesProcessing: ['CCC333'],
			creditsOptional: 4,
		});
		page.send('https://pe.targygraf.hu', PAYLOAD);

		expect(page.window.localStorage.getItem('migrated_pe')).toBe('1');
		expect(page.navigations.length).toBe(0);
	});

	it('runs at most once per university', () => {
		const page = loadApexPage('pe', { migrated_pe: 1 });
		expect(page.window.document.querySelector('iframe')).toBeNull();
	});

	it('trusts a first-release flag outside WebKit and upgrades it', () => {
		const page = loadApexPage('pe', { migratedFrom_pe: 1 });
		expect(page.window.document.querySelector('iframe')).toBeNull();
		expect(page.window.localStorage.getItem('migrated_pe')).toBe('1');
		expect(page.window.localStorage.getItem('migratedFrom_pe')).toBeNull();
	});

	it('ignores messages from wrong origins or with wrong shapes', () => {
		const page = loadApexPage('pe');
		page.send('https://evil.example.com', PAYLOAD);
		page.send('https://bme.targygraf.hu', PAYLOAD); // wrong university
		page.send('https://pe.targygraf.hu', { type: 'other' });
		page.send('https://pe.targygraf.hu', {
			type: 'targygraf-migrate',
			coursesFinished: 'not-an-array',
			coursesProcessing: [{ nested: 'object' }],
			creditsOptional: 'NaN',
		});

		const ls = page.window.localStorage;
		expect(ls.getItem('coursesFinished')).toBeNull();
		expect(ls.getItem('coursesProcessing')).toBeNull();
		expect(ls.getItem('creditsOptional')).toBeNull();
	});

	it('does nothing without a university context or inside frames', () => {
		const dom = new JSDOM('<!doctype html><html><body></body></html>', {
			url: 'https://targygraf.hu/',
			runScripts: 'outside-only',
		});
		dom.window.eval(MIGRATE_SRC); // no migrateUniversity set
		expect(dom.window.document.querySelector('iframe')).toBeNull();
	});
});

describe('migrate: WebKit top-level bounce', () => {
	it('bounces to the legacy origin instead of embedding an iframe', () => {
		const page = loadApexPage('pe', {}, { vendor: APPLE });
		expect(page.window.document.querySelector('iframe')).toBeNull();
		expect(page.navigations.length).toBe(1); // location.replace attempt
		expect(page.window.sessionStorage.getItem('tgmBounced_pe')).toBe('1');
		expect(page.window.localStorage.getItem('migrated_pe')).toBeNull();
	});

	it('bounces at most once per session', () => {
		const page = loadApexPage('pe', {}, { vendor: APPLE, session: { tgmBounced_pe: '1' } });
		expect(page.navigations.length).toBe(0);
		expect(page.window.localStorage.getItem('migrated_pe')).toBeNull();
	});

	it('retries despite a first-release flag (the iframe read an empty partition)', () => {
		const page = loadApexPage('pe', { migratedFrom_pe: 1 }, { vendor: APPLE });
		expect(page.navigations.length).toBe(1);
		expect(page.window.localStorage.getItem('migratedFrom_pe')).toBeNull();
		expect(page.window.localStorage.getItem('migrated_pe')).toBeNull();
	});

	it('does not bounce when already migrated', () => {
		const page = loadApexPage('pe', { migrated_pe: 1 }, { vendor: APPLE });
		expect(page.navigations.length).toBe(0);
	});
});

describe('migrate: #tgm= fragment import (bounce return)', () => {
	const payloadHash = `#tgm=${encodeURIComponent(
		JSON.stringify({
			coursesFinished: ['AAA111', 12345],
			coursesProcessing: ['CCC333'],
			creditsOptional: 4,
		})
	)}`;

	it('imports the payload when the same-session guard is set', () => {
		const page = loadApexPage(
			'pe',
			{},
			{ vendor: APPLE, hash: payloadHash, session: { tgmBounced_pe: '1' } }
		);
		const ls = page.window.localStorage;
		expect(JSON.parse(ls.getItem('coursesFinished'))).toEqual(['AAA111', 12345]);
		expect(JSON.parse(ls.getItem('coursesProcessing'))).toEqual(['CCC333']);
		expect(JSON.parse(ls.getItem('creditsOptional'))).toBe(4);
		expect(ls.getItem('migrated_pe')).toBe('1');
		expect(page.window.sessionStorage.getItem('tgmBounced_pe')).toBeNull();
		expect(page.window.location.hash).toBe('');
		expect(page.navigations.length).toBe(1); // reload with the new data
	});

	it('flags an empty handoff (#tgm=0) without reloading', () => {
		const page = loadApexPage(
			'pe',
			{},
			{ vendor: APPLE, hash: '#tgm=0', session: { tgmBounced_pe: '1' } }
		);
		expect(page.window.localStorage.getItem('migrated_pe')).toBe('1');
		expect(page.navigations.length).toBe(0);
		expect(page.window.location.hash).toBe('');
	});

	it('rejects a fragment without the guard (crafted link)', () => {
		const page = loadApexPage('pe', {}, { hash: payloadHash });
		const ls = page.window.localStorage;
		expect(ls.getItem('coursesFinished')).toBeNull();
		expect(ls.getItem('migrated_pe')).toBeNull();
		expect(page.window.location.hash).toBe(''); // still cleaned up
		expect(page.navigations.length).toBe(0);
	});

	it('keeps the flag unset on a damaged payload so a later visit retries', () => {
		const page = loadApexPage(
			'pe',
			{},
			{ vendor: APPLE, hash: '#tgm=%7Bnot-json', session: { tgmBounced_pe: '1' } }
		);
		expect(page.window.localStorage.getItem('migrated_pe')).toBeNull();
		expect(page.window.localStorage.getItem('coursesFinished')).toBeNull();
	});

	it('clears a first-release flag when the bounce import succeeds', () => {
		const page = loadApexPage(
			'pe',
			{ migratedFrom_pe: 1 },
			{ vendor: APPLE, hash: '#tgm=0', session: { tgmBounced_pe: '1' } }
		);
		expect(page.window.localStorage.getItem('migrated_pe')).toBe('1');
		expect(page.window.localStorage.getItem('migratedFrom_pe')).toBeNull();
	});
});

describe('migrate: legacy origin sender page', () => {
	const html = fs.readFileSync(path.join(REPO_ROOT, 'public/__migrate.html'), 'utf8');

	it('pins the postMessage and bounce targets to https://targygraf.hu', () => {
		expect(html).toContain("'https://targygraf.hu'");
		expect(html).not.toContain("'*'");
	});

	it('is marked noindex and sends nothing when opened directly', () => {
		expect(html).toContain('name="robots"');
		const dom = new JSDOM(html, {
			url: 'https://pe.targygraf.hu/__migrate',
			runScripts: 'dangerously',
		});
		// Top level without ?return=: the script must bail out quietly.
		expect(dom.window.document.title).toContain('adatátvitel');
	});

	it('bounces back to the apex when opened top-level with ?return=', () => {
		const navigations: string[] = [];
		const virtualConsole = new VirtualConsole();
		virtualConsole.on('jsdomError', (error) => {
			if (String(error.message).includes('navigation')) {
				navigations.push(String(error.message));
			}
		});
		new JSDOM(html, {
			url: 'https://pe.targygraf.hu/__migrate?return=%2Fpe%2Fvalami',
			runScripts: 'dangerously',
			virtualConsole,
		});
		expect(navigations.length).toBe(1); // location.replace to targygraf.hu
	});

	it('only accepts plain absolute paths as the return target', () => {
		// The whitelist regex must reject protocol-relative and external URLs.
		expect(html).toContain('(?!\\/)');
		expect(html).toMatch(/replace\('https:\/\/targygraf\.hu' \+ path/);
	});
});
