/**
 * Structural tests over the real build output (dist-test/, built by
 * test/global-setup.ts).
 *
 * The critical suite is the "localStorage contract": the shipped, unmodified
 * targygraf.js restores user state by querying .course[data-code="..."] with
 * codes persisted from the Laravel-rendered pages, so every page must expose
 * exactly the codes the JSON defines, with fixed-width ids and well-formed
 * prerequisite tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { HTMLElement, parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';

import {
	OPTIONAL_COURSE_CODE,
	SEPARATOR_COURSE_CODE,
	getDataset,
	isDummyCreditCode,
	listJsonFiles,
	trimParens,
} from '../src/lib/data';
import { JSON_ROOT, REPO_ROOT } from '../src/lib/paths';
import { DIST } from './global-setup';

const skip = process.env.SKIP_BUILD_TESTS === '1';

function readPage(dist: string, ...segments: string[]): HTMLElement {
	return parse(fs.readFileSync(path.join(dist, ...segments), 'utf8'));
}

function programFiles(): string[] {
	return listJsonFiles(path.join(JSON_ROOT, 'programs'));
}

function rawProgram(file: string): any {
	return JSON.parse(fs.readFileSync(path.join(JSON_ROOT, 'programs', file), 'utf8'));
}

describe.skipIf(skip)('build output inventory', () => {
	it('emits exactly one page per university and per program plus chrome', () => {
		for (const dist of [DIST]) {
			expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true);
			expect(fs.existsSync(path.join(dist, '404.html'))).toBe(true);
			expect(fs.existsSync(path.join(dist, 'sitemap.xml'))).toBe(true);

			for (const file of listJsonFiles(path.join(JSON_ROOT, 'universities'))) {
				const slug = path.basename(file, '.json');
				expect(fs.existsSync(path.join(dist, `${slug}.html`)), slug).toBe(true);
			}
			for (const file of programFiles()) {
				const [uni, , prog] = path.basename(file, '.json').split('_');
				expect(fs.existsSync(path.join(dist, uni!, `${prog}.html`)), file).toBe(true);
			}
		}
	});

	it('ships the frontend assets referenced by the pages', () => {
		for (const asset of [
			'assets/js/targygraf.js',
			'assets/css/style.css',
			'assets/css/tipsy.css',
			'icon.png',
			'favicon.ico',
			'favicon.svg',
			'favicon-32.png',
			'apple-touch-icon.png',
			'og.png',
			'robots.txt',
		]) {
			expect(fs.existsSync(path.join(DIST, asset)), asset).toBe(true);
		}
	});

	it('ships a dependency-free frontend (no jQuery anywhere)', () => {
		const targygraf = fs.readFileSync(
			path.join(DIST, 'assets/js/targygraf.js'),
			'utf8'
		);
		// The header comment may mention jQuery historically; actual usage
		// patterns must not appear.
		expect(targygraf).not.toMatch(/window\.jQuery|\$\(|\.tipsy\(/);
		// The storage keys are the frozen contract with users' saved data.
		for (const key of ['coursesFinished', 'coursesProcessing', 'creditsOptional']) {
			expect(targygraf).toContain(key);
		}

		expect(fs.existsSync(path.join(DIST, 'assets/js/jquery.tipsy.min.js'))).toBe(false);

		const page = fs.readFileSync(path.join(DIST, 'pe', 'mernokinformatikus.html'), 'utf8');
		expect(page.toLowerCase()).not.toContain('jquery');
	});
});

describe.skipIf(skip)('localStorage contract on every program page', () => {
	// Parsed once; each expectation still pinpoints the file it failed in.
	it('exposes data-code for exactly the JSON course codes', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			const raw = rawProgram(file);

			const expected = raw.course_blocks
				.flatMap((b: any) => b.courses)
				.filter((c: any) => c.code !== SEPARATOR_COURSE_CODE)
				.map((c: any) => c.code ?? '');
			const actual = page
				.querySelectorAll('.course')
				.map((el) => el.getAttribute('data-code') ?? '');

			expect(actual, file).toEqual(expected);
		}
	});

	it('renders every ______ separator as <hr> and never as a course', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			const raw = rawProgram(file);

			const separators = raw.course_blocks
				.flatMap((b: any) => b.courses)
				.filter((c: any) => c.code === SEPARATOR_COURSE_CODE).length;
			expect(page.querySelectorAll('.course-block hr'), file).toHaveLength(separators);
		}
	});

	it('uses fixed-width ids that are safe for jQuery substring matching', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);

			const courseIds = page
				.querySelectorAll('.course')
				.map((el) => el.getAttribute('data-id')!);
			expect(new Set(courseIds).size, file).toBe(courseIds.length);
			for (const id of courseIds) {
				expect(id, file).toMatch(/^\d{6}$/);
				// jQuery .data('id') must NOT coerce the value to a number.
				expect(String(Number(id)), file).not.toBe(id);
			}

			const blockIds = page
				.querySelectorAll('.course-block')
				.map((el) => el.getAttribute('data-id')!);
			expect(new Set(blockIds).size, file).toBe(blockIds.length);
			for (const id of blockIds) {
				expect(id, file).toMatch(/^_*\d+$/);
				expect(id, file).toHaveLength(6);
			}
		}
	});

	it('maps data-prerequisites tokens back to the JSON prerequisites', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			const raw = rawProgram(file);

			const idToCode = new Map<string, string>();
			for (const el of page.querySelectorAll('.course')) {
				idToCode.set(el.getAttribute('data-id')!, el.getAttribute('data-code') ?? '');
			}

			const rawCourses = raw.course_blocks
				.flatMap((b: any) => b.courses)
				.filter((c: any) => c.code !== SEPARATOR_COURSE_CODE);
			const pageCourses = page.querySelectorAll('.course');

			rawCourses.forEach((rawCourse: any, i: number) => {
				const el = pageCourses[i]!;
				const attr = el.getAttribute('data-prerequisites') ?? '';
				const tokens = attr === '' ? [] : attr.split(',');
				const rawTokens = rawCourse.prerequisites ?? [];
				expect(tokens, `${file} ${rawCourse.code}`).toHaveLength(rawTokens.length);

				// The attribute order follows the live site's referenced-id
				// ordering (credit gates first, then page position), so compare
				// as decoded (code, parallel) pairs, order-insensitively, and
				// verify each id resolves to the first course with that code.
				const decoded = tokens.map((token: string) => {
					const parallel = token.startsWith('#');
					const id = parallel ? token.slice(1) : token;
					const code = isDummyCreditCode(id) ? id : idToCode.get(id);
					if (!isDummyCreditCode(id)) {
						const firstWithCode = pageCourses.find(
							(c) => c.getAttribute('data-code') === code
						)!;
						expect(id, `${file} ${rawCourse.code} -> ${code}`).toBe(
							firstWithCode.getAttribute('data-id')
						);
					}
					return `${parallel ? '#' : ''}${code}`;
				});
				const expected = rawTokens.map(
					(rawToken: string) =>
						`${/^\(.+\)$/.test(rawToken) ? '#' : ''}${trimParens(rawToken)}`
				);
				expect(decoded.slice().sort(), `${file} ${rawCourse.code}`).toEqual(
					expected.slice().sort()
				);
			});
		}
	});

	it('maps data-referenced-course-blocks to blocks by JSON name', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			const raw = rawProgram(file);

			// Block name -> padded id, first JSON occurrence wins (file order
			// equals seeder insertion order, ids are 1-based file positions).
			const nameToId = new Map<string, string>();
			raw.course_blocks.forEach((b: any, i: number) => {
				if (!nameToId.has(b.name)) {
					nameToId.set(b.name, String(i + 1).padStart(6, '_'));
				}
			});

			const rawCourses = raw.course_blocks
				.flatMap((b: any) => b.courses)
				.filter((c: any) => c.code !== SEPARATOR_COURSE_CODE);
			const pageCourses = page.querySelectorAll('.course');

			rawCourses.forEach((rawCourse: any, i: number) => {
				const attr = pageCourses[i]!.getAttribute('data-referenced-course-blocks') ?? '';
				const tokens = attr === '' ? [] : attr.split(',');
				const expected = (rawCourse.course_block_references ?? [])
					.map((name: string) => nameToId.get(name)!)
					// The attribute follows referenced-block id order (see the
					// prerequisite ordering note).
					.sort(
						(a: string, b: string) =>
							parseInt(a.replace(/_/g, ''), 10) - parseInt(b.replace(/_/g, ''), 10)
					);
				expect(tokens, `${file} ${rawCourse.name}`).toEqual(expected);
			});

			// And each token points at an existing block element.
			const blockIds = new Set(
				page.querySelectorAll('.course-block').map((el) => el.getAttribute('data-id'))
			);
			for (const el of pageCourses) {
				const attr = el.getAttribute('data-referenced-course-blocks') ?? '';
				for (const token of attr === '' ? [] : attr.split(',')) {
					expect(blockIds.has(token), `${file} ${attr}`).toBe(true);
				}
			}
		}
	});

	it('renders data-credits and data-is-counted exactly like Blade', () => {
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			const raw = rawProgram(file);

			const rawCourses = raw.course_blocks
				.flatMap((b: any) => b.courses)
				.filter((c: any) => c.code !== SEPARATOR_COURSE_CODE);
			page.querySelectorAll('.course').forEach((el, i) => {
				expect(el.getAttribute('data-credits'), file).toBe(String(rawCourses[i].credits));
			});

			const sortedBlocks = [...raw.course_blocks].sort(
				(a: any, b: any) => a.row - b.row
			);
			page.querySelectorAll('.course-block').forEach((el, i) => {
				const expected = sortedBlocks[i].is_counted !== false ? '1' : '0';
				expect(el.getAttribute('data-is-counted'), file).toBe(expected);
			});
		}
	});

	it('keeps ___OPTIONAL___ courses clickable-inert but present', () => {
		let optionalSeen = 0;
		for (const file of programFiles()) {
			const [uni, , prog] = path.basename(file, '.json').split('_');
			const page = readPage(DIST, uni!, `${prog}.html`);
			optionalSeen += page
				.querySelectorAll('.course')
				.filter((el) => el.getAttribute('data-code') === OPTIONAL_COURSE_CODE).length;
		}
		expect(optionalSeen).toBeGreaterThan(200);
	});
});

describe.skipIf(skip)('page chrome', () => {
	it('home page lists every university alphabetically, no special placement', () => {
		const dataset = getDataset();
		const collator = new Intl.Collator('hu');
		const expected = [...dataset.universities]
			.sort((a, b) => collator.compare(a.name, b.name))
			.map((u) => `/${u.slug}`);
		const page = readPage(DIST, 'index.html');
		const links = page.querySelectorAll('a.university');
		expect(links.map((a) => a.getAttribute('href'))).toEqual(expected);
	});

	it('university pages list all their programs with path links', () => {
		const dataset = getDataset();
		for (const university of dataset.universities) {
			const expectedPrograms = university.faculties.flatMap((f) =>
				f.programs.map((p) => p.slug)
			);

			const pathPage = readPage(DIST, `${university.slug}.html`);
			expect(
				pathPage.querySelectorAll('.program-selector a.program').map((a) => a.getAttribute('href')),
				university.slug
			).toEqual(expectedPrograms.map((slug) => `/${university.slug}/${slug}`));
		}
	});

	it('program pages carry the hidden program selector with active marker', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		expect(page.querySelector('.program-selector .toggle')).not.toBeNull();
		const faculties = page.querySelector('.program-selector .faculties')!;
		expect(faculties.getAttribute('style')).toContain('display: none');
		const active = page.querySelectorAll('.program-selector a.program.active');
		expect(active).toHaveLength(1);
		expect(active[0]!.getAttribute('href')).toBe('/pe/mernokinformatikus');
	});

	it('program pages include help, progressbar, credits counter and reset button', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		expect(page.querySelector('main .help')).not.toBeNull();
		expect(page.querySelector('.progressbar')).not.toBeNull();
		expect(page.querySelector('.credits-counter .credits-optional')).not.toBeNull();
		expect(page.querySelector('.buttons .reset')).not.toBeNull();
	});

	it('sets per-page titles and apex canonical URLs', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		expect(page.querySelector('title')!.text).toBe(
			'Pannon Egyetem - Mérnökinformatikus | Tárgygráf'
		);
		expect(page.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
			'https://targygraf.hu/pe/mernokinformatikus'
		);

		const uniPage = readPage(DIST, 'pe.html');
		expect(uniPage.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
			'https://targygraf.hu/pe'
		);

		const home = readPage(DIST, 'index.html');
		expect(home.querySelector('title')!.text).toBe('Tárgygráf');
		expect(home.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
			'https://targygraf.hu/'
		);
	});

	it('loads the client stack in order', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		const scripts = page
			.querySelectorAll('script[src]')
			.map((s) => s.getAttribute('src')!);
		expect(scripts).toEqual([
			'https://www.googletagmanager.com/gtag/js?id=G-1T3XF9V5BL',
			'/assets/js/targygraf.js?v=20260831',
		]);
	});

	it('configures the GA4 property', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		const inline = page.querySelectorAll('script:not([src])').map((s) => s.text);
		expect(inline.some((t) => t.includes("gtag('config', 'G-1T3XF9V5BL')"))).toBe(true);
	});

	it('ships viewport meta only on responsive pages, never on graph pages', () => {
		// The graph relies on the no-viewport zoom-out behavior on phones.
		const program = readPage(DIST, 'pe', 'mernokinformatikus.html');
		expect(program.querySelector('meta[name="viewport"]')).toBeNull();

		const home = readPage(DIST, 'index.html');
		expect(home.querySelector('meta[name="viewport"]')).not.toBeNull();
		const university = readPage(DIST, 'pe.html');
		expect(university.querySelector('meta[name="viewport"]')).not.toBeNull();
	});

	it('renders the landing hero with real dataset stats', () => {
		const home = readPage(DIST, 'index.html');
		expect(home.querySelector('.hero h1')).not.toBeNull();
		expect(home.querySelector('.hero-demo')).not.toBeNull();
		const stats = home.querySelectorAll('.hero-stats span').map((s) => s.text.trim());
		expect(stats[0]).toBe('12 egyetem');
		expect(stats[1]).toBe('26 kar');
		expect(stats[2]).toBe('89 szak');
		expect(stats[3]).toMatch(/tantárgy$/);
	});

	it('ships complete OpenGraph tags and no Twitter cards', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		const og = (prop: string) =>
			page.querySelector(`meta[property="og:${prop}"]`)?.getAttribute('content');

		expect(og('site_name')).toBe('Tárgygráf');
		expect(og('type')).toBe('website');
		expect(og('locale')).toBe('hu_HU');
		expect(og('title')).toBe('Pannon Egyetem - Mérnökinformatikus | Tárgygráf');
		expect(og('url')).toBe('https://targygraf.hu/pe/mernokinformatikus');
		expect(og('url')).toBe(
			page.querySelector('link[rel="canonical"]')!.getAttribute('href')
		);
		expect(og('image')).toBe('https://targygraf.hu/og.png');
		expect(og('image:width')).toBe('1200');
		expect(og('image:height')).toBe('630');
		expect(og('image:alt')).toBeTruthy();
		expect(page.querySelectorAll('meta[name^="twitter"]')).toHaveLength(0);

		const home = readPage(DIST, 'index.html');
		expect(
			home.querySelector('meta[property="og:url"]')!.getAttribute('content')
		).toBe('https://targygraf.hu/');
	});

	it('links the favicon set', () => {
		const page = readPage(DIST, 'index.html');
		expect(page.querySelector('link[rel="icon"][type="image/svg+xml"]')!.getAttribute('href')).toBe('/favicon.svg');
		expect(page.querySelector('link[rel="icon"][type="image/png"]')!.getAttribute('href')).toBe('/favicon-32.png');
		expect(page.querySelector('link[rel="apple-touch-icon"]')!.getAttribute('href')).toBe('/apple-touch-icon.png');
	});

	it('lists every page in the sitemap with apex path URLs', () => {
		const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
		expect(sitemap).toContain('<loc>https://targygraf.hu/</loc>');
		expect(sitemap).toContain('<loc>https://targygraf.hu/pe</loc>');
		expect(sitemap).toContain('<loc>https://targygraf.hu/pe/mernokinformatikus</loc>');
		expect(sitemap.match(/<loc>/g)).toHaveLength(1 + 12 + 89);
	});
});
