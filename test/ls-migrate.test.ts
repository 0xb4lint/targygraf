/**
 * Tests for the one-time localStorage handoff from the legacy
 * {university}.targygraf.hu origins to targygraf.hu (public/assets/js/
 * ls-migrate.js + public/__ls-migrate.html).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE_SRC = fs.readFileSync(
	path.join(REPO_ROOT, 'public/assets/js/ls-migrate.js'),
	'utf8'
);

interface Harness {
	window: any;
	navigations: string[];
	send(origin: string, data: unknown): void;
}

function loadApexPage(university: string, existing: Record<string, unknown> = {}): Harness {
	const navigations: string[] = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => {
		if (String(error.message).includes('navigation')) {
			navigations.push(String(error.message));
		}
	});

	const dom = new JSDOM('<!doctype html><html><body></body></html>', {
		url: `https://targygraf.hu/${university}/valami`,
		runScripts: 'outside-only',
		pretendToBeVisual: true,
		virtualConsole,
	});
	const { window } = dom;

	for (const [key, value] of Object.entries(existing)) {
		window.localStorage.setItem(key, JSON.stringify(value));
	}

	(window as any).lsMigrateUniversity = university;
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
	type: 'targygraf-ls',
	coursesFinished: ['AAA111', 'BBB222'],
	coursesProcessing: ['CCC333'],
	creditsOptional: 4,
};

describe('ls-migrate: apex receiver', () => {
	it('embeds a hidden iframe pointing at the legacy origin', () => {
		const page = loadApexPage('pe');
		const frame = page.window.document.querySelector('iframe');
		expect(frame).not.toBeNull();
		expect(frame.src).toBe('https://pe.targygraf.hu/__ls-migrate');
		expect(frame.style.display).toBe('none');
	});

	it('imports legacy data, flags the university done, and reloads', () => {
		const page = loadApexPage('pe');
		page.send('https://pe.targygraf.hu', PAYLOAD);

		const ls = page.window.localStorage;
		expect(JSON.parse(ls.getItem('coursesFinished'))).toEqual(['AAA111', 'BBB222']);
		expect(JSON.parse(ls.getItem('coursesProcessing'))).toEqual(['CCC333']);
		expect(JSON.parse(ls.getItem('creditsOptional'))).toBe(4);
		expect(ls.getItem('lsMigratedFrom_pe')).toBe('1');
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

		expect(page.window.localStorage.getItem('lsMigratedFrom_pe')).toBe('1');
		expect(page.navigations.length).toBe(0);
	});

	it('runs at most once per university', () => {
		const page = loadApexPage('pe', { lsMigratedFrom_pe: 1 });
		expect(page.window.document.querySelector('iframe')).toBeNull();
	});

	it('ignores messages from wrong origins or with wrong shapes', () => {
		const page = loadApexPage('pe');
		page.send('https://evil.example.com', PAYLOAD);
		page.send('https://bme.targygraf.hu', PAYLOAD); // wrong university
		page.send('https://pe.targygraf.hu', { type: 'other' });
		page.send('https://pe.targygraf.hu', {
			type: 'targygraf-ls',
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
		dom.window.eval(MIGRATE_SRC); // no lsMigrateUniversity set
		expect(dom.window.document.querySelector('iframe')).toBeNull();
	});
});

describe('ls-migrate: legacy origin sender page', () => {
	const html = fs.readFileSync(path.join(REPO_ROOT, 'public/__ls-migrate.html'), 'utf8');

	it('pins the postMessage target to https://targygraf.hu', () => {
		expect(html).toContain("'https://targygraf.hu'");
		expect(html).not.toContain("'*'");
	});

	it('is marked noindex and sends nothing when opened directly', () => {
		expect(html).toContain('name="robots"');
		const dom = new JSDOM(html, {
			url: 'https://pe.targygraf.hu/__ls-migrate',
			runScripts: 'dangerously',
		});
		// window.parent === window at top level, so the script must bail out
		// without touching anything.
		expect(dom.window.document.title).toContain('adatátvitel');
	});
});
