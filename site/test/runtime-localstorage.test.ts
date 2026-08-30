/**
 * End-to-end localStorage compatibility tests.
 *
 * These run the REAL, unmodified public/assets/js/targygraf.js with the real
 * jQuery 3.2.1 inside jsdom, against the freshly built pages, seeding
 * window.localStorage with data in the exact format the Laravel-era site
 * wrote ('coursesFinished'/'coursesProcessing' as JSON arrays of course
 * codes, 'creditsOptional' as a JSON number). This is the strongest guard
 * that existing users' saved progress keeps working without any glitch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';

import { getDataset, findProgram, type Program } from '../src/lib/data';
import { DIST_PATH_MODE } from './global-setup';

const skip = process.env.SKIP_BUILD_TESTS === '1';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JQUERY_SRC = fs.readFileSync(
	path.join(SITE_ROOT, 'node_modules/jquery/dist/jquery.js'),
	'utf8'
);

interface Storage {
	finished?: (string | number)[];
	processing?: (string | number)[];
	optional?: number;
}

interface LoadedPage {
	window: any;
	$: any;
	errors: string[];
	notieAlerts: number;
}

async function loadProgramPage(
	universitySlug: string,
	programSlug: string,
	storage: Storage = {}
): Promise<LoadedPage> {
	const html = fs.readFileSync(
		path.join(DIST_PATH_MODE, universitySlug, `${programSlug}.html`),
		'utf8'
	);
	const targygrafSrc = fs.readFileSync(
		path.join(DIST_PATH_MODE, 'assets/js/targygraf.js'),
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
		// The URL fixes the localStorage origin, mirroring the per-university
		// subdomains in production.
		url: `https://${universitySlug}.targygraf.hu/${programSlug}`,
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

	const state = { notieAlerts: 0 };
	window.eval(JQUERY_SRC);
	// Stub the purely cosmetic pieces (tooltips, toast, dead analytics).
	(window as any).__state = state;
	window.eval(`
		jQuery.fn.tipsy = function () { return this; };
		window.notie = { alert: function () { window.__state.notieAlerts++; } };
		window.ga = function () {};
		window.alert = function () {};
		window.confirm = function () { return true; };
	`);
	window.eval(targygrafSrc);

	// jQuery fires ready on a microtask once readyState is no longer loading.
	await new Promise((resolve) => setTimeout(resolve, 50));

	return { window, $: (window as any).jQuery, errors, notieAlerts: state.notieAlerts };
}

function classesByCode(page: LoadedPage, code: string): string[] {
	return page
		.$(`.course[data-code="${code}"]`)
		.toArray()
		.map((el: any) => el.className);
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
const pe = dataset.universitiesBySlug.get('pe')!;
const mernokinfo = findProgram(pe, 'mernokinformatikus')!.program;

describe.skipIf(skip)('fresh visitor (no stored data)', () => {
	let page: LoadedPage;
	beforeAll(async () => {
		page = await loadProgramPage('pe', 'mernokinformatikus');
	});

	it('initializes without script errors and shows the legal toast', () => {
		expect(page.errors).toEqual([]);
		expect(page.notieAlerts).toBe(1);
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
		expect(page.$('.credits-counter .finished').html()).toBe(
			'Teljesített: <b>6 kredit</b>'
		);
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
		expect(page.$('.credits-counter .processing').html()).toBe(
			'Felvett: <b>2 kredit</b>'
		);
	});
});

describe.skipIf(skip)('legacy creditsOptional restore', () => {
	it('shows the stored value and marks affordable optional slots', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', { optional: 3 });
		expect(page.errors).toEqual([]);
		expect(page.$('.credits-counter .credits-optional').text()).toBe('3');
		// The 3-credit ___OPTIONAL___ slot is covered, so it renders finished.
		const optionals = page
			.$('.course[data-code="___OPTIONAL___"]')
			.toArray()
			.map((el: any) => ({
				credits: page.$(el).data('credits'),
				finished: /(^| )finished( |$)/.test(el.className),
			}));
		expect(optionals.some((o: any) => o.credits === 3 && o.finished)).toBe(true);
	});
});

describe.skipIf(skip)('codes from other curricula are never lost', () => {
	it('keeps unknown stored codes across an interaction round-trip', async () => {
		// A user may have progress saved from another program on the same
		// university subdomain (shared origin). Those codes are not on this
		// page and MUST survive a save cycle.
		const foreign = ['XXFOREIGN101', 'XXFOREIGN202'];
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: [...foreign, 'VEMIMAB144IN'],
			processing: ['XXFOREIGNPROC'],
		});
		expect(page.errors).toEqual([]);

		// Click a processable course; the handler calls saveDataToLocalStorage.
		page.$('.course[data-code="VEMIMAB122MA"]').trigger('click');

		const finished = JSON.parse(page.window.localStorage.getItem('coursesFinished'));
		const processing = JSON.parse(page.window.localStorage.getItem('coursesProcessing'));
		expect(finished).toContain('XXFOREIGN101');
		expect(finished).toContain('XXFOREIGN202');
		expect(finished).toContain('VEMIMAB144IN');
		expect(processing).toContain('XXFOREIGNPROC');
		expect(processing).toContain('VEMIMAB122MA');
	});
});

describe.skipIf(skip)('click lifecycle writes the legacy format', () => {
	it('process -> finish -> remove round-trips through localStorage', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus');
		expect(page.errors).toEqual([]);
		const $course = page.$('.course[data-code="VEMIMAB144IN"]');

		$course.trigger('click'); // felvett
		expect(JSON.parse(page.window.localStorage.getItem('coursesProcessing'))).toEqual([
			'VEMIMAB144IN',
		]);

		$course.trigger('click'); // teljesített
		expect(JSON.parse(page.window.localStorage.getItem('coursesFinished'))).toEqual([
			'VEMIMAB144IN',
		]);
		expect(JSON.parse(page.window.localStorage.getItem('coursesProcessing'))).toEqual([]);

		$course.trigger('click'); // leadás
		expect(JSON.parse(page.window.localStorage.getItem('coursesFinished'))).toEqual([]);
	});

	it('reset button clears all three legacy keys', async () => {
		const page = await loadProgramPage('pe', 'mernokinformatikus', {
			finished: ['VEMIMAB144IN'],
			optional: 2,
		});
		page.$('.buttons .reset').trigger('click');
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

		const referencing = page
			.$('.course')
			.toArray()
			.filter((el: any) => (el.getAttribute('data-referenced-course-blocks') || '') !== '');
		expect(referencing.length).toBeGreaterThan(0);
		for (const el of referencing) {
			expect(el.className, el.textContent.trim()).toContain('finished');
		}
	});
});

describe.skipIf(skip)('every program page boots the legacy script cleanly', () => {
	it('initializes all 89 pages without errors', async () => {
		for (const university of dataset.universities) {
			for (const faculty of university.faculties) {
				for (const program of faculty.programs) {
					const page = await loadProgramPage(university.slug, program.slug);
					expect(page.errors, `${university.slug}/${program.slug}`).toEqual([]);
					expect(page.notieAlerts, `${university.slug}/${program.slug}`).toBe(1);
					page.window.close();
				}
			}
		}
	}, 240_000);
});
