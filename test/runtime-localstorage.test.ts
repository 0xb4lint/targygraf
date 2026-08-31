/**
 * End-to-end localStorage + behavior tests for the shipped frontend.
 *
 * The assertions in this file were validated against the pre-2026 engine
 * first (see git history), so passing here pins behavioral parity:
 * localStorage is seeded in the exact format the site has always written
 * ('coursesFinished'/'coursesProcessing' as JSON arrays of course codes,
 * 'creditsOptional' as a JSON number), and the shipped targygraf.js runs
 * against the real built pages in jsdom.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';

import { getDataset, findProgram, type Program } from '../src/lib/data';
import { DIST } from './global-setup';

const skip = process.env.SKIP_BUILD_TESTS === '1';

interface Storage {
	finished?: (string | number)[];
	processing?: (string | number)[];
	optional?: number;
}

interface LoadedPage {
	window: any;
	document: any;
	errors: string[];
}

async function loadProgramPage(
	universitySlug: string,
	programSlug: string,
	storage: Storage = {}
): Promise<LoadedPage> {
	const html = fs.readFileSync(
		path.join(DIST, universitySlug, `${programSlug}.html`),
		'utf8'
	);
	const targygrafSrc = fs.readFileSync(
		path.join(DIST, 'assets/js/targygraf.js'),
		'utf8'
	);

	const errors: string[] = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => {
		// jsdom cannot navigate; the reset button's location.reload() lands here.
		if (!String(error.message).includes('navigation')) {
			errors.push(String(error.message));
		}
	});

	const dom = new JSDOM(html, {
		url: `https://targygraf.hu/${universitySlug}/${programSlug}`,
		runScripts: 'outside-only',
		pretendToBeVisual: true,
		virtualConsole,
	});
	const { window } = dom;

	// Seed storage in the legacy format before any script runs.
	if (storage.finished) {
		window.localStorage.setItem('coursesFinished', JSON.stringify(storage.finished));
	}
	if (storage.processing) {
		window.localStorage.setItem('coursesProcessing', JSON.stringify(storage.processing));
	}
	if (storage.optional !== undefined) {
		window.localStorage.setItem('creditsOptional', JSON.stringify(storage.optional));
	}

	// Stub the dialogs.
	window.eval(`
		window.alert = function () {};
		window.confirm = function () { return true; };
	`);
	window.eval(targygrafSrc);

	// Init is synchronous once the document is parsed, but give queued
	// microtasks a tick anyway.
	await new Promise((resolve) => setTimeout(resolve, 10));

	return { window, document: window.document, errors };
}

/** Boots a non-program page (home, university) with the shipped script. */
async function loadChromePage(relative: string[], url: string): Promise<LoadedPage> {
	const html = fs.readFileSync(path.join(DIST, ...relative), 'utf8');
	const targygrafSrc = fs.readFileSync(
		path.join(DIST, 'assets/js/targygraf.js'),
		'utf8'
	);
	const errors: string[] = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => {
		if (!String(error.message).includes('navigation')) {
			errors.push(String(error.message));
		}
	});
	const dom = new JSDOM(html, {
		url,
		runScripts: 'outside-only',
		pretendToBeVisual: true,
		virtualConsole,
	});
	dom.window.eval(targygrafSrc);
	await new Promise((resolve) => setTimeout(resolve, 10));
	return { window: dom.window, document: dom.window.document, errors };
}

function byCode(page: LoadedPage, code: string): any[] {
	return [...page.document.querySelectorAll('.course')].filter(
		(el: any) => el.getAttribute('data-code') === code
	);
}

function classesByCode(page: LoadedPage, code: string): string[] {
	return byCode(page, code).map((el) => el.className);
}

function hover(page: LoadedPage, el: any, type: 'mouseenter' | 'mouseleave') {
	el.dispatchEvent(new page.window.MouseEvent(type));
}

/** All restorable (clickable) course codes of a program in display order. */
function clickableCodes(program: Program): { code: string; credits: number }[] {
	return program.blocks
		.filter((block) => block.row === 0)
		.flatMap((block) => block.courses)
		.filter(
			(course) =>
				course.code !== null &&
				!/^___.*___$/.test(course.code!) &&
				course.code !== '______' &&
				course.courseBlockReferences.length === 0
		)
		.map((course) => ({ code: course.code!, credits: course.credits }));
}

const dataset = getDataset();

describe.skipIf(skip)('fresh visitor (no stored data)', () => {
	let page: LoadedPage;
	beforeAll(async () => {
		page = await loadProgramPage('pe', 'mernokinformatikus');
	});

	it('initializes without script errors and shows the legal notice', () => {
		expect(page.errors).toEqual([]);
		const notice = page.document.querySelector('.site-notice');
		expect(notice).not.toBeNull();
		expect(notice.textContent).toContain('Tájékoztató jellegű oldal');
	});

	it('syncs duplicate-code courses on click and unlocks dependents (#127)', async () => {
		// KOKUA201 appears four times (same name, no prerequisites) and
		// KOKUA202 depends on it; data-prerequisites points at the first
		// occurrence, so completing any copy must mark them all in-session.
		const page = await loadProgramPage('bme', 'kozlekedesmernok');
		expect(page.errors).toEqual([]);

		const copies = byCode(page, 'KOKUA201');
		expect(copies.length).toBe(4);

		copies[3].click();
		expect(
			classesByCode(page, 'KOKUA201').every((c) => c.includes('processing'))
		).toBe(true);

		copies[3].click();
		expect(
			classesByCode(page, 'KOKUA201').every((c) => c.includes('finished'))
		).toBe(true);
		expect(classesByCode(page, 'KOKUA202')[0]).toContain('processable');

		// Stored once, counted once.
		const stored = JSON.parse(page.window.localStorage.getItem('coursesFinished'));
		expect(stored.filter((c: string) => c === 'KOKUA201')).toHaveLength(1);
		expect(
			page.document.querySelector('.credits-counter .finished').textContent
		).toBe('Teljesített: 5 kredit');

		// Leadás reverts every copy.
		copies[3].click();
		expect(
			classesByCode(page, 'KOKUA201').every((c) => c.includes('processable'))
		).toBe(true);
		expect(JSON.parse(page.window.localStorage.getItem('coursesFinished'))).toEqual([]);
	});

	it('does not group distinct courses that share a placeholder code', async () => {
		const page = await loadProgramPage('szie', 'muszaki-menedzser');
		expect(page.errors).toEqual([]);

		const cells = byCode(page, 'SGMxxXxxXN');
		const biologia = cells.find(
			(el: any) => el.textContent.trim() === 'Alkalmazott biológia'
		);
		biologia.click();
		expect(biologia.className).toContain('processing');
		const marked = cells.filter((el: any) => el.className.includes('processing'));
		expect(marked).toHaveLength(1);
	});

	it('keeps the legal notice off the home and university pages', async () => {
		const home = await loadChromePage(['index.html'], 'https://targygraf.hu/');
		expect(home.errors).toEqual([]);
		expect(home.document.querySelector('.site-notice')).toBeNull();

		const uni = await loadChromePage(['pe.html'], 'https://targygraf.hu/pe');
		expect(uni.errors).toEqual([]);
		expect(uni.document.querySelector('.site-notice')).toBeNull();
	});

	it('marks courses without prerequisites as processable', () => {
		expect(classesByCode(page, 'VEMIMAB144IN')[0]).toContain('processable');
		expect(classesByCode(page, 'VEMIMAB122MA')[0]).toContain('processable');
	});

	it('leaves courses with unmet prerequisites unavailable', () => {
		// VEMIMAB244DI requires VEMIMAB144IN.
		expect(classesByCode(page, 'VEMIMAB244DI')[0]).not.toContain('processable');
	});

	it('does not invent storage entries', () => {
		expect(page.window.localStorage.getItem('coursesFinished')).toBeNull();
	});

	it('hides the reset button while there is nothing to reset', () => {
		expect(page.document.querySelector('.buttons .reset').style.display).toBe('none');
	});
});

describe.skipIf(skip)('legacy coursesFinished restore', () => {
	let page: LoadedPage;
	beforeAll(async () => {
		page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: ['VEMIMAB144IN', 'VEMIMAB122MA'],
		});
	});

	it('applies the finished class to the stored codes', () => {
		expect(page.errors).toEqual([]);
		expect(classesByCode(page, 'VEMIMAB144IN')[0]).toContain('finished');
		expect(classesByCode(page, 'VEMIMAB122MA')[0]).toContain('finished');
	});

	it('unlocks their sequels', () => {
		// VEMIMAB244DI requires VEMIMAB144IN, now finished.
		expect(classesByCode(page, 'VEMIMAB244DI')[0]).toContain('processable');
	});

	it('sums finished credits into the counter', () => {
		// VEMIMAB144IN = 4 credits, VEMIMAB122MA = 2 credits.
		expect(page.document.querySelector('.credits-counter .finished').innerHTML).toBe(
			'Teljesített: <b>6 kredit</b>'
		);
	});

	it('shows the reset button', () => {
		expect(page.document.querySelector('.buttons .reset').style.display).toBe('');
	});
});

describe.skipIf(skip)('legacy coursesProcessing restore', () => {
	it('restores taken courses and satisfies parallel prerequisites', async () => {
		// VEMIMAB346MA has the parallel prerequisite (VEMIMAB122MA):
		// having it merely in progress must unlock the dependent course.
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			processing: ['VEMIMAB122MA'],
		});
		expect(page.errors).toEqual([]);
		expect(classesByCode(page, 'VEMIMAB122MA')[0]).toContain('processing');
		expect(classesByCode(page, 'VEMIMAB346MA')[0]).toContain('processable');
		expect(page.document.querySelector('.credits-counter .processing').innerHTML).toBe(
			'Felvett: <b>2 kredit</b>'
		);
	});
});

describe.skipIf(skip)('legacy creditsOptional restore', () => {
	it('shows the stored value and marks affordable optional slots', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', { optional: 3 });
		expect(page.errors).toEqual([]);
		expect(
			page.document.querySelector('.credits-counter .credits-optional').textContent
		).toBe('3');
		// The 3-credit ___OPTIONAL___ slot is covered, so it renders finished.
		const optionals = byCode(page, '___OPTIONAL___').map((el) => ({
			credits: parseInt(el.getAttribute('data-credits'), 10),
			finished: el.classList.contains('finished'),
		}));
		expect(optionals.some((o) => o.credits === 3 && o.finished)).toBe(true);
	});
});

describe.skipIf(skip)('codes from other curricula are never lost', () => {
	it('keeps unknown stored codes across an interaction round-trip', async () => {
		// A user may have progress saved from another program (storage was per
		// university subdomain, now apex-wide). Codes not on this page MUST
		// survive a save cycle.
		const foreign = ['XXFOREIGN101', 'XXFOREIGN202'];
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: [...foreign, 'VEMIMAB144IN'],
			processing: ['XXFOREIGNPROC'],
		});
		expect(page.errors).toEqual([]);

		// Click a processable course; the handler saves everything back.
		byCode(page, 'VEMIMAB122MA')[0].click();

		const finished = JSON.parse(page.window.localStorage.getItem('coursesFinished'));
		const processing = JSON.parse(page.window.localStorage.getItem('coursesProcessing'));
		expect(finished).toContain('XXFOREIGN101');
		expect(finished).toContain('XXFOREIGN202');
		expect(finished).toContain('VEMIMAB144IN');
		expect(processing).toContain('XXFOREIGNPROC');
		expect(processing).toContain('VEMIMAB122MA');
	});

	it('keeps numeric codes from old storage intact', async () => {
		// Years-old storage may hold numeric-looking codes saved as numbers;
		// such values must not break or vanish.
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: [12345, 'VEMIMAB144IN'],
		});
		expect(page.errors).toEqual([]);
		byCode(page, 'VEMIMAB122MA')[0].click();
		const finished = JSON.parse(page.window.localStorage.getItem('coursesFinished'));
		expect(finished).toContain(12345);
	});
});

describe.skipIf(skip)('click lifecycle writes the legacy format', () => {
	it('process -> finish -> remove round-trips through localStorage', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		expect(page.errors).toEqual([]);
		const course = byCode(page, 'VEMIMAB144IN')[0];

		course.click(); // felvett
		expect(JSON.parse(page.window.localStorage.getItem('coursesProcessing'))).toEqual([
			'VEMIMAB144IN',
		]);

		course.click(); // teljesített
		expect(JSON.parse(page.window.localStorage.getItem('coursesFinished'))).toEqual([
			'VEMIMAB144IN',
		]);
		expect(JSON.parse(page.window.localStorage.getItem('coursesProcessing'))).toEqual([]);

		course.click(); // leadás
		expect(JSON.parse(page.window.localStorage.getItem('coursesFinished'))).toEqual([]);
	});

	it('refuses to un-finish a course that finished sequels depend on', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: ['VEMIMAB144IN', 'VEMIMAB244DI'], // 244DI requires 144IN
		});
		byCode(page, 'VEMIMAB144IN')[0].click();
		// The alert (stubbed) fires and nothing changes.
		expect(classesByCode(page, 'VEMIMAB144IN')[0]).toContain('finished');
	});

	it('sends debounced GA4 course events when gtag is present', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		const events: any[] = [];
		page.window.eval('window.__gtagCalls = [];');
		page.window.eval(
			'window.gtag = function () { window.__gtagCalls.push(Array.prototype.slice.call(arguments)); };'
		);

		const course = byCode(page, 'VEMIMAB144IN')[0];
		course.click(); // felvett
		course.click(); // teljesített -- within the debounce window

		// Nothing fires immediately; the 1500ms debounce collapses the two
		// clicks into the final action, exactly like the original ga() code.
		expect(page.window.__gtagCalls).toHaveLength(0);
		await new Promise((resolve) => setTimeout(resolve, 1700));
		expect(page.window.__gtagCalls).toEqual([
			[
				'event',
				'Teljesítés',
				{ event_category: 'Tantárgy', event_label: course.textContent.trim() },
			],
		]);
	});

	it('works without gtag (analytics blocked or absent)', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		byCode(page, 'VEMIMAB144IN')[0].click();
		await new Promise((resolve) => setTimeout(resolve, 1700));
		expect(page.errors).toEqual([]);
	});

	it('reset button clears all three legacy keys', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: ['VEMIMAB144IN'],
			optional: 2,
		});
		page.document.querySelector('.buttons .reset').click();
		expect(page.window.localStorage.getItem('coursesFinished')).toBeNull();
		expect(page.window.localStorage.getItem('coursesProcessing')).toBeNull();
		expect(page.window.localStorage.getItem('creditsOptional')).toBeNull();
	});
});

describe.skipIf(skip)('credit-gate prerequisites (___n___)', () => {
	const bme = dataset.universitiesBySlug.get('bme')!;
	const fizika = findProgram(bme, 'fizika')!.program;
	// BMETE15AF11 requires ___120___ (at least 120 finished credits).
	const GATED = 'BMETE15AF11';

	function codesSummingTo(target: number): string[] {
		const picked: string[] = [];
		let sum = 0;
		for (const { code, credits } of clickableCodes(fizika)) {
			if (code === GATED) continue;
			if (sum >= target) break;
			picked.push(code);
			sum += credits;
		}
		expect(sum).toBeGreaterThanOrEqual(target);
		return picked;
	}

	it('stays locked below the credit threshold', async () => {
		const page = await loadProgramPage('bme', 'fizika', {
			finished: codesSummingTo(30),
		});
		expect(page.errors).toEqual([]);
		expect(classesByCode(page, GATED)[0]).not.toContain('processable');
	});

	it('unlocks once stored finished credits reach the threshold', async () => {
		const page = await loadProgramPage('bme', 'fizika', {
			finished: codesSummingTo(120),
		});
		expect(page.errors).toEqual([]);
		expect(classesByCode(page, GATED)[0]).toContain('processable');
	});
});

describe.skipIf(skip)('referenced course blocks (differenciált blokkok)', () => {
	it('finishing stored block courses completes the referencing courses', async () => {
		const bme = dataset.universitiesBySlug.get('bme')!;
		const jarmu = findProgram(bme, 'jarmumernok')!.program;

		// Store every course of every row>0 block as finished; that covers
		// whatever the referencing courses require.
		const blockCodes = jarmu.blocks
			.filter((block) => block.row > 0)
			.flatMap((block) => block.courses)
			.map((course) => course.code)
			.filter((code): code is string => Boolean(code) && !/^___.*___$/.test(code!));
		expect(blockCodes.length).toBeGreaterThan(0);

		const page = await loadProgramPage('bme', 'jarmumernok', { finished: blockCodes });
		expect(page.errors).toEqual([]);

		const referencing = [...page.document.querySelectorAll('.course')].filter(
			(el: any) => (el.getAttribute('data-referenced-course-blocks') || '') !== ''
		);
		expect(referencing.length).toBeGreaterThan(0);
		for (const el of referencing) {
			expect(el.className, el.textContent.trim()).toContain('finished');
		}
	});
});

describe.skipIf(skip)('hover interactions', () => {
	it('highlights prerequisites and sequels, and clears them on leave', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		const dependent = byCode(page, 'VEMIMAB346MA')[0]; // requires (VEMIMAB122MA)

		hover(page, dependent, 'mouseenter');
		expect(classesByCode(page, 'VEMIMAB122MA')[0]).toContain('prerequisite');
		hover(page, dependent, 'mouseleave');
		expect(classesByCode(page, 'VEMIMAB122MA')[0]).not.toContain('prerequisite');

		const base = byCode(page, 'VEMIMAB122MA')[0];
		hover(page, base, 'mouseenter');
		expect(classesByCode(page, 'VEMIMAB346MA')[0]).toContain('sequel');
		hover(page, base, 'mouseleave');
		expect(classesByCode(page, 'VEMIMAB346MA')[0]).not.toContain('sequel');
	});

	it('shows tipsy-styled tooltips with the course title HTML', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		const course = byCode(page, 'VEMIMAB346MA')[0];

		// The title attribute moves to original-title (suppressing the native
		// tooltip), exactly like the retired tipsy plugin did.
		expect(course.getAttribute('title')).toBeNull();
		expect(course.getAttribute('original-title')).toContain('6 kredit - VEMIMAB346MA');

		hover(page, course, 'mouseenter');
		const tip = page.document.querySelector('.tipsy');
		expect(tip).not.toBeNull();
		expect(tip.className).toBe('tipsy tipsy-s');
		expect(tip.querySelector('.tipsy-inner').innerHTML).toBe(
			'6 kredit - VEMIMAB346MA<hr>• Matematikai alapismeretek <u>felvétele</u>'
		);
		expect(tip.querySelector('.tipsy-arrow').className).toBe('tipsy-arrow tipsy-arrow-s');

		hover(page, course, 'mouseleave');
		expect(page.document.querySelector('.tipsy')).toBeNull();
	});

	it('toggles the program selector dropdown open and closed', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		const toggle = page.document.querySelector('.program-selector .toggle');
		const faculties = page.document.querySelector('.program-selector .faculties');
		expect(faculties.style.display).toBe('none');

		toggle.click();
		expect(faculties.style.display).toBe('');
		expect(toggle.classList.contains('open')).toBe(true);

		toggle.click();
		expect(faculties.style.display).toBe('none');
		expect(toggle.classList.contains('open')).toBe(false);
	});

	it('uses east gravity for the side buttons', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: ['VEMIMAB144IN'], // the reset button only shows with data
		});
		const button = page.document.querySelector('.buttons .button.reset');
		hover(page, button, 'mouseenter');
		const tip = page.document.querySelector('.tipsy');
		expect(tip.className).toBe('tipsy tipsy-e');
		expect(tip.querySelector('.tipsy-inner').textContent).toBe('Adatok törlése');
		hover(page, button, 'mouseleave');
	});
});

describe.skipIf(skip)('every program page boots the frontend cleanly', () => {
	it('initializes all 109 pages without errors', async () => {
		for (const university of dataset.universities) {
			for (const faculty of university.faculties) {
				for (const program of faculty.programs) {
					const page = await loadProgramPage(university.slug, program.slug);
					expect(page.errors, `${university.slug}/${program.slug}`).toEqual([]);
					expect(
						page.document.querySelector('.site-notice'),
						`${university.slug}/${program.slug}`
					).not.toBeNull();
					page.window.close();
				}
			}
		}
	}, 240_000);
});
