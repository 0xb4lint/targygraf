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
			'assets/js/jquery.tipsy.min.js',
			'assets/js/notie.min.js',
			'assets/css/style.css',
			'assets/css/tipsy.css',
			'assets/css/notie.min.css',
			'icon.png',
			'favicon.ico',
			'robots.txt',
		]) {
			expect(fs.existsSync(path.join(DIST, asset)), asset).toBe(true);
		}
	});

	it('ships targygraf.js byte-identical to the Laravel-served copy', () => {
		// The frontend is the localStorage contract; until the Laravel tree is
		// deleted, the two copies must never drift apart.
		const laravel = fs.readFileSync(
			path.join(REPO_ROOT, 'public/assets/js/targygraf.js')
		);
		const site = fs.readFileSync(path.join(DIST, 'assets/js/targygraf.js'));
		expect(site.equals(laravel)).toBe(true);
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
	it('home page links every university in row/ordering order', () => {
		const dataset = getDataset();
		const page = readPage(DIST, 'index.html');
		const links = page.querySelectorAll('a.university');
		expect(links.map((a) => a.getAttribute('href'))).toEqual(
			dataset.universities.map((u) => `/${u.slug}`)
		);
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

	it('loads the untouched client stack in order', () => {
		const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
		const scripts = page
			.querySelectorAll('script[src]')
			.map((s) => s.getAttribute('src')!);
		expect(scripts).toEqual([
			'https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js',
			'/assets/js/jquery.tipsy.min.js',
			'/assets/js/notie.min.js',
			'/assets/js/targygraf.js?v=20190625',
			'/assets/js/ls-migrate.js?v=1',
		]);
		// The ga() no-op stub must exist because targygraf.js calls window.ga.
		const inline = page.querySelectorAll('script:not([src])').map((s) => s.text);
		expect(inline.some((t) => t.includes('window.ga = window.ga ||'))).toBe(true);
	});

	it('wires the localStorage migration bridge on university and program pages', () => {
		for (const [segments, expected] of [
			[['pe', 'mernokinformatikus.html'], 'pe'],
			[['bme.html'], 'bme'],
		] as const) {
			const page = readPage(DIST, ...segments);
			const inline = page.querySelectorAll('script:not([src])').map((s) => s.text);
			expect(
				inline.some((t) => t.includes(`window.lsMigrateUniversity="${expected}"`)),
				segments.join('/')
			).toBe(true);
		}

		// The home page has no university context, so no bridge there.
		const home = readPage(DIST, 'index.html');
		const inline = home.querySelectorAll('script[src]').map((s) => s.getAttribute('src')!);
		expect(inline).not.toContain('/assets/js/ls-migrate.js?v=1');

		// The handoff endpoint itself ships in the build, marked noindex.
		const handoff = readPage(DIST, '__ls-migrate.html');
		expect(handoff.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe(
			'noindex'
		);
		expect(handoff.text).toContain('targygraf-ls');
		expect(fs.existsSync(path.join(DIST, 'assets/js/ls-migrate.js'))).toBe(true);
	});

	it('never emits a viewport meta (the live layout depends on its absence)', () => {
		{
			const page = readPage(DIST, 'pe', 'mernokinformatikus.html');
			expect(page.querySelector('meta[name="viewport"]')).toBeNull();
		}
	});

	it('lists every page in the sitemap with apex path URLs', () => {
		const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
		expect(sitemap).toContain('<loc>https://targygraf.hu/</loc>');
		expect(sitemap).toContain('<loc>https://targygraf.hu/pe</loc>');
		expect(sitemap).toContain('<loc>https://targygraf.hu/pe/mernokinformatikus</loc>');
		expect(sitemap.match(/<loc>/g)).toHaveLength(1 + 12 + 89);
	});
});
