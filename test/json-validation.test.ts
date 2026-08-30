/**
 * The JSON validation suite that gates contributor pull requests: structure,
 * unknown-field (typo) detection, prerequisite and block-reference
 * resolution, and filename shape (the file name IS the slug).
 *
 * Contributors are students editing JSON in the GitHub web editor, so every
 * failure message is a self-contained Hungarian sentence naming the file,
 * the exact spot and the fix. The final test loads the whole dataset through
 * the real build-time loader, so nothing the granular checks might miss can
 * slip through either.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DUMMY_CREDIT_COURSE_CODES, loadDataset } from '../src/lib/data';
import { JSON_ROOT } from '../src/lib/paths';

const DIRECTORIES = ['universities', 'faculties', 'programs'] as const;
const CREDIT_GATES = DUMMY_CREDIT_COURSE_CODES.join(', ');
const SEPARATOR = '______';
const OPTIONAL = '___OPTIONAL___';

function visibleFiles(directory: string): string[] {
	return fs
		.readdirSync(path.join(JSON_ROOT, directory))
		.filter((file) => file[0] !== '.')
		.sort();
}

function readJson(directory: string, file: string): any {
	const raw = fs.readFileSync(path.join(JSON_ROOT, directory, file), 'utf8');
	let data: any;
	try {
		data = JSON.parse(raw);
	} catch (error) {
		throw new Error(
			`${directory}/${file}: érvénytelen JSON. ${(error as Error).message}. ` +
				'Tipp: vessző maradt a lista utolsó eleme után, vagy hiányzik egy idézőjel / zárójel?'
		);
	}
	if (data === null || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error(
			`${directory}/${file}: a fájl tartalma egyetlen JSON objektum ({ ... }) kell legyen`
		);
	}
	return data;
}

function isUint(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFilledString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Requires every listed field and rejects everything else, so a typo like
 * "prerequisite" or "kredits" fails loudly instead of being ignored.
 */
function checkFields(context: string, value: any, required: string[], optional: string[] = []) {
	expect(
		value !== null && typeof value === 'object' && !Array.isArray(value),
		`${context}: JSON objektum ({ ... }) kell legyen`
	).toBe(true);

	for (const key of required) {
		expect(key in value, `${context}: hiányzik a kötelező "${key}" mező`).toBe(true);
	}

	const allowed = [...required, ...optional];
	for (const key of Object.keys(value)) {
		expect(
			allowed.includes(key),
			`${context}: ismeretlen mező: "${key}" (elgépelés?). ` +
				`Használható mezők: ${allowed.join(', ')}`
		).toBe(true);
	}
}

describe.each(DIRECTORIES.map((d) => [d] as const))('json/%s', (directory) => {
	it('directory exists', () => {
		expect(fs.statSync(path.join(JSON_ROOT, directory)).isDirectory()).toBe(true);
	});

	it('contains only .json files', () => {
		for (const file of visibleFiles(directory)) {
			expect(
				file,
				`${directory}/${file}: minden fájl kiterjesztése .json legyen`
			).toMatch(/\.json$/);
		}
	});

	it('contains only valid JSON', () => {
		for (const file of visibleFiles(directory)) {
			readJson(directory, file);
		}
	});
});

describe('json/universities structure', () => {
	it.each(visibleFiles('universities').map((f) => [f] as const))('%s', (file) => {
		const context = `universities/${file}`;
		const data = readJson('universities', file);

		for (const legacy of ['row', 'ordering']) {
			expect(
				legacy in data,
				`${context}: a "${legacy}" örökölt mező már nincs használatban, töröld a sort`
			).toBe(false);
		}
		checkFields(context, data, ['name', 'has_logo']);
		expect(
			isFilledString(data.name),
			`${context}: a "name" nem üres szöveg kell legyen`
		).toBe(true);
		expect(
			typeof data.has_logo,
			`${context}: a "has_logo" true vagy false lehet (hagyd false-on)`
		).toBe('boolean');
		// The filename is the slug and becomes the URL path.
		expect(
			file,
			`${context}: a fájlnév az egyetem kódja: csak kisbetű, szám és kötőjel ` +
				'(ez lesz az URL: targygraf.hu/{egyetem})'
		).toMatch(/^[a-z0-9-]+\.json$/);
	});
});

describe('json/faculties structure', () => {
	it.each(visibleFiles('faculties').map((f) => [f] as const))('%s', (file) => {
		const context = `faculties/${file}`;
		const data = readJson('faculties', file);

		checkFields(context, data, ['name', 'ordering']);
		expect(
			isFilledString(data.name),
			`${context}: a "name" nem üres szöveg kell legyen`
		).toBe(true);
		expect(
			isUint(data.ordering),
			`${context}: az "ordering" nemnegatív egész szám (a kar sorrendje az egyetem oldalán)`
		).toBe(true);
		expect(
			file,
			`${context}: a fájlnév pontosan {egyetem}_{kar}.json, csak kisbetű, szám és kötőjel`
		).toMatch(/^[a-z0-9-]+_[a-z0-9-]+\.json$/);

		const universityFile = `${file.split('_')[0]}.json`;
		expect(
			fs.existsSync(path.join(JSON_ROOT, 'universities', universityFile)),
			`${context}: nincs hozzá egyetem: universities/${universityFile} hiányzik ` +
				'(előbb vidd fel az egyetemet)'
		).toBe(true);
	});
});

describe('json/programs structure', () => {
	it.each(visibleFiles('programs').map((f) => [f] as const))('%s', (file) => {
		const data = readJson('programs', file);

		expect(
			file,
			`programs/${file}: a fájlnév pontosan {egyetem}_{kar}_{szak}.json, ` +
				'csak kisbetű, szám és kötőjel (a szak neve lesz az URL)'
		).toMatch(/^[a-z0-9-]+_[a-z0-9-]+_[a-z0-9-]+\.json$/);

		const parts = path.basename(file, '.json').split('_');
		const facultyFile = `${parts[0]}_${parts[1]}.json`;
		expect(
			fs.existsSync(path.join(JSON_ROOT, 'faculties', facultyFile)),
			`programs/${file}: nincs hozzá kar: faculties/${facultyFile} hiányzik ` +
				'(előbb vidd fel a kart)'
		).toBe(true);

		checkFields(file, data, ['name', 'description', 'curriculum_updated_at', 'course_blocks']);
		expect(
			isFilledString(data.name),
			`${file}: a "name" nem üres szöveg kell legyen`
		).toBe(true);
		expect(
			isFilledString(data.description),
			`${file}: a "description" nem üres szöveg kell legyen`
		).toBe(true);
		expect(
			data.curriculum_updated_at === null ||
				(typeof data.curriculum_updated_at === 'string' &&
					/^\d{4}-\d{2}-\d{2}$/.test(data.curriculum_updated_at) &&
					!Number.isNaN(Date.parse(data.curriculum_updated_at))),
			`${file}: a "curriculum_updated_at" ÉÉÉÉ-HH-NN formátumú dátum legyen ` +
				`(pl. "2024-05-20"), kaptam: ${JSON.stringify(data.curriculum_updated_at)}`
		).toBe(true);
		expect(
			Array.isArray(data.course_blocks),
			`${file}: a "course_blocks" lista ([ ... ]) kell legyen`
		).toBe(true);

		for (const courseBlock of data.course_blocks) {
			checkCourseBlock(file, courseBlock, data);
		}
	});

	// Belt and braces: whatever the granular checks above might miss, the
	// real build-time loader must also accept every file without throwing.
	it('a teljes adathalmaz betölthető a generátorral', () => {
		expect(() => loadDataset()).not.toThrow();
	});
});

function checkCourseBlock(file: string, courseBlock: any, data: any) {
	const context = `${file} / ${JSON.stringify(courseBlock?.name)} blokk`;

	checkFields(context, courseBlock, ['name', 'row', 'courses'], ['is_counted']);
	expect(
		isFilledString(courseBlock.name),
		`${context}: a blokk "name" mezője nem üres szöveg kell legyen`
	).toBe(true);
	// Only rows 0-2 are rendered; anything else would vanish.
	expect(
		isUint(courseBlock.row) && courseBlock.row <= 2,
		`${context}: a "row" 0 (félévsor), 1 vagy 2 (alsó sorok) lehet, ` +
			`kaptam: ${JSON.stringify(courseBlock.row)}`
	).toBe(true);
	expect(
		courseBlock.is_counted === undefined || typeof courseBlock.is_counted === 'boolean',
		`${context}: az "is_counted" csak true vagy false lehet (vagy hagyd el)`
	).toBe(true);
	expect(
		Array.isArray(courseBlock.courses),
		`${context}: a "courses" lista ([ ... ]) kell legyen`
	).toBe(true);

	for (const course of courseBlock.courses) {
		checkCourse(file, courseBlock, course);
		checkCoursePrerequisites(file, courseBlock, course, data);
		checkCourseBlockReferences(file, courseBlock, course, data);
	}
}

function courseContext(file: string, courseBlock: any, course: any): string {
	const label = course?.code ?? course?.name ?? course;
	return `${file} / ${JSON.stringify(courseBlock?.name)} blokk / ${JSON.stringify(label)} tárgy`;
}

function checkCourse(file: string, courseBlock: any, course: any) {
	const context = courseContext(file, courseBlock, course);

	checkFields(context, course, ['code', 'name', 'credits'], [
		'prerequisites',
		'course_block_references',
	]);

	expect(
		typeof course.name === 'string' || course.code === SEPARATOR,
		`${context}: a "name" szöveg kell legyen ` +
			`(csak a "${SEPARATOR}" elválasztónál lehet null)`
	).toBe(true);

	expect(
		typeof course.code === 'string' ||
			(course.code === null && Array.isArray(course.course_block_references)),
		`${context}: a "code" szöveg kell legyen; null csak akkor lehet, ha a tárgy ` +
			'a "course_block_references" mezővel tárgycsoportra hivatkozik'
	).toBe(true);

	// Underscore-prefixed codes are reserved for the pseudo-courses.
	if (typeof course.code === 'string' && course.code.startsWith('_')) {
		expect(
			course.code === SEPARATOR || course.code === OPTIONAL,
			`${context}: a "_" jellel kezdődő kódok foglaltak: csak a "${SEPARATOR}" ` +
				`(elválasztó) és az "${OPTIONAL}" (szabadon választható keret) használható`
		).toBe(true);
	}

	expect(
		isUint(course.credits),
		`${context}: a "credits" nemnegatív egész szám kell legyen, ` +
			`kaptam: ${JSON.stringify(course.credits)}`
	).toBe(true);

	expect(
		course.prerequisites === undefined || Array.isArray(course.prerequisites),
		`${context}: a "prerequisites" lista ([ ... ]) kell legyen (vagy hagyd el)`
	).toBe(true);

	expect(
		course.course_block_references === undefined ||
			Array.isArray(course.course_block_references),
		`${context}: a "course_block_references" lista ([ ... ]) kell legyen (vagy hagyd el)`
	).toBe(true);
}

function checkCoursePrerequisites(file: string, courseBlock: any, course: any, data: any) {
	if (!Array.isArray(course?.prerequisites)) {
		return;
	}
	const context = courseContext(file, courseBlock, course);

	for (const token of course.prerequisites) {
		expect(
			typeof token === 'string',
			`${context}: minden előfeltétel szöveg kell legyen (idézőjelben), ` +
				`kaptam: ${JSON.stringify(token)}`
		).toBe(true);
		if (typeof token !== 'string') {
			continue;
		}

		// Either a bare code or exactly one pair of parentheses (= parallel).
		expect(
			/^[^()]+$/.test(token) || /^\([^()]+\)$/.test(token),
			`${context}: hibás előfeltétel: ${JSON.stringify(token)}. ` +
				'Írd zárójel nélkül, vagy ha egyidejűleg felvehető, pontosan egy zárójelpárban: "(KÓD)"'
		).toBe(true);

		const code = token.replace(/^[()]+/, '').replace(/[()]+$/, '');
		if (/^___\d+___$/.test(code)) {
			expect(
				(DUMMY_CREDIT_COURSE_CODES as readonly string[]).includes(code),
				`${context}: ismeretlen kreditkapu: "${code}". Használható: ${CREDIT_GATES}`
			).toBe(true);
		} else {
			expect(
				courseCodeExists(code, data),
				`${context}: ismeretlen előfeltétel-kód: "${code}". A kódnak ugyanebben a ` +
					`fájlban kell szerepelnie egy tárgynál; kreditkapuhoz használd ezeket: ${CREDIT_GATES}`
			).toBe(true);
		}
	}
}

function checkCourseBlockReferences(file: string, courseBlock: any, course: any, data: any) {
	if (!Array.isArray(course?.course_block_references)) {
		return;
	}
	const context = courseContext(file, courseBlock, course);

	for (const reference of course.course_block_references) {
		expect(
			typeof reference === 'string',
			`${context}: minden blokkhivatkozás szöveg kell legyen (a blokk pontos neve), ` +
				`kaptam: ${JSON.stringify(reference)}`
		).toBe(true);
		expect(
			typeof reference === 'string' &&
				data.course_blocks.some((block: any) => block?.name === reference),
			`${context}: ismeretlen blokknév a hivatkozásban: ${JSON.stringify(reference)}. ` +
				'A hivatkozott blokk "name" mezőjével betűre pontosan egyeznie kell'
		).toBe(true);
	}
}

function courseCodeExists(code: string, data: any): boolean {
	return data.course_blocks.some(
		(block: any) =>
			Array.isArray(block?.courses) &&
			block.courses.some((course: any) => course?.code === code)
	);
}
