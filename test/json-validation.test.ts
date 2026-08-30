/**
 * The JSON validation suite that gates contributor pull requests: structure,
 * prerequisite and block-reference resolution, and filename shape (the file
 * name IS the slug).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DUMMY_CREDIT_COURSE_CODES } from '../src/lib/data';
import { JSON_ROOT } from '../src/lib/paths';

const DIRECTORIES = ['universities', 'faculties', 'programs'] as const;

function visibleFiles(directory: string): string[] {
	return fs
		.readdirSync(path.join(JSON_ROOT, directory))
		.filter((file) => file[0] !== '.')
		.sort();
}

function readJson(directory: string, file: string): any {
	return JSON.parse(fs.readFileSync(path.join(JSON_ROOT, directory, file), 'utf8'));
}

function isUint(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

describe.each(DIRECTORIES.map((d) => [d] as const))('json/%s', (directory) => {
	it('directory exists', () => {
		expect(fs.statSync(path.join(JSON_ROOT, directory)).isDirectory()).toBe(true);
	});

	it('contains only .json files', () => {
		for (const file of visibleFiles(directory)) {
			expect(file, `${directory}/${file}`).toMatch(/\.json$/);
		}
	});

	it('contains only valid JSON', () => {
		for (const file of visibleFiles(directory)) {
			expect(() => readJson(directory, file), `${directory}/${file}`).not.toThrow();
		}
	});
});

describe('json/universities structure', () => {
	it.each(visibleFiles('universities').map((f) => [f] as const))('%s', (file) => {
		const data = readJson('universities', file);
		expect(typeof data.name, `${file} name is_string`).toBe('string');
		expect(typeof data.has_logo, `${file} has_logo is_bool`).toBe('boolean');
		// Removed legacy display fields; display order is alphabetical.
		expect(data.row, `${file} row is a removed legacy field`).toBeUndefined();
		expect(data.ordering, `${file} ordering is a removed legacy field`).toBeUndefined();
		// The filename is the slug and becomes the URL path.
		expect(file).toMatch(/^[a-z0-9-]+\.json$/);
	});
});

describe('json/faculties structure', () => {
	it.each(visibleFiles('faculties').map((f) => [f] as const))('%s', (file) => {
		const data = readJson('faculties', file);
		expect(typeof data.name, `${file} name is_string`).toBe('string');
		expect(isUint(data.ordering), `${file} ordering uint`).toBe(true);
		// Exactly {university}_{faculty}: only parts 0-1 carry meaning.
		expect(file).toMatch(/^[a-z0-9-]+_[a-z0-9-]+\.json$/);

		const universityFile = `${file.split('_')[0]}.json`;
		expect(
			fs.existsSync(path.join(JSON_ROOT, 'universities', universityFile)),
			`${file}: missing universities/${universityFile}`
		).toBe(true);
	});
});

describe('json/programs structure', () => {
	it.each(visibleFiles('programs').map((f) => [f] as const))('%s', (file) => {
		const data = readJson('programs', file);

		// Exactly {university}_{faculty}_{program}: only parts 0-2 carry
		// meaning; anything after a third underscore would be ignored.
		expect(file).toMatch(/^[a-z0-9-]+_[a-z0-9-]+_[a-z0-9-]+\.json$/);

		const parts = path.basename(file, '.json').split('_');
		const facultyFile = `${parts[0]}_${parts[1]}.json`;
		expect(
			fs.existsSync(path.join(JSON_ROOT, 'faculties', facultyFile)),
			`${file}: missing faculties/${facultyFile}`
		).toBe(true);

		expect(typeof data.name, 'name is_string').toBe('string');
		expect(typeof data.description, 'description is_string').toBe('string');
		expect(
			data.curriculum_updated_at === null ||
				(typeof data.curriculum_updated_at === 'string' &&
					/^\d{4}-\d{2}-\d{2}$/.test(data.curriculum_updated_at) &&
					!Number.isNaN(Date.parse(data.curriculum_updated_at))),
			`curriculum_updated_at is_null || Y-m-d date (${data.curriculum_updated_at})`
		).toBe(true);
		expect(Array.isArray(data.course_blocks), 'course_blocks is_array').toBe(true);

		for (const courseBlock of data.course_blocks) {
			checkCourseBlock(file, courseBlock, data);
		}
	});
});

function checkCourseBlock(file: string, courseBlock: any, data: any) {
	const context = `${file} block ${JSON.stringify(courseBlock.name)}`;
	expect(typeof courseBlock.name, `${context} name is_string`).toBe('string');
	expect(isUint(courseBlock.row), `${context} row uint`).toBe(true);
	// Only rows 0-2 are rendered; anything else would vanish.
	expect(courseBlock.row, `${context} row <= 2`).toBeLessThanOrEqual(2);
	expect(Array.isArray(courseBlock.courses), `${context} courses is_array`).toBe(true);

	for (const course of courseBlock.courses) {
		checkCourse(file, course);
		checkCoursePrerequisites(file, course, data);
		checkCourseBlockReferences(file, course, data);
	}
}

function checkCourse(file: string, course: any) {
	const context = `${file} course ${JSON.stringify(course.code ?? course.name)}`;

	expect(
		typeof course.name === 'string' || course.code === '______',
		`${context} name is_string || code(______)`
	).toBe(true);

	expect(
		typeof course.code === 'string' ||
			(course.course_block_references !== undefined &&
				Array.isArray(course.course_block_references)),
		`${context} code is_string || is_array(course_block_references)`
	).toBe(true);

	expect(isUint(course.credits), `${context} credits uint`).toBe(true);

	expect(
		course.prerequisites === undefined || Array.isArray(course.prerequisites),
		`${context} prerequisites !isset || is_array`
	).toBe(true);

	expect(
		course.course_block_references === undefined ||
			Array.isArray(course.course_block_references),
		`${context} course_block_references !isset || is_array`
	).toBe(true);
}

function checkCoursePrerequisites(file: string, course: any, data: any) {
	for (const prerequisite of course.prerequisites ?? []) {
		const code = String(prerequisite).replace(/^[()]+/, '').replace(/[()]+$/, '');
		expect(
			courseCodeExists(code, data),
			`${file}: prerequisite invalid: ${code} - ${JSON.stringify(course)}`
		).toBe(true);
	}
}

function checkCourseBlockReferences(file: string, course: any, data: any) {
	for (const reference of course.course_block_references ?? []) {
		expect(
			data.course_blocks.some((block: any) => block.name === reference),
			`${file}: course_block_reference invalid: ${reference} - ${JSON.stringify(course)}`
		).toBe(true);
	}
}

function courseCodeExists(code: string, data: any): boolean {
	if ((DUMMY_CREDIT_COURSE_CODES as readonly string[]).includes(code)) {
		return true;
	}
	return data.course_blocks.some((block: any) =>
		block.courses.some((course: any) => course.code === code)
	);
}
