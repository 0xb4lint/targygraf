import { describe, expect, it } from 'vitest';

import type { Course, CourseBlock } from '../src/lib/data';
import {
	courseBlockDisplayName,
	courseBlockReferencesAttribute,
	courseTitle,
	isCountedAttribute,
	isCurriculumOutdated,
	pageTitle,
	prerequisitesAttribute,
} from '../src/lib/render';

function course(overrides: Partial<Course>): Course {
	return {
		paddedId: '000001',
		code: 'ABC123',
		name: 'Tárgy',
		credits: 4,
		prerequisites: [],
		courseBlockReferences: [],
		...overrides,
	};
}

function block(overrides: Partial<CourseBlock>): CourseBlock {
	return {
		paddedId: '_____1',
		name: '1. félév',
		row: 0,
		isCounted: true,
		courses: [],
		...overrides,
	};
}

describe('courseTitle (Course::getTitle port)', () => {
	it('renders credits and code for a plain course', () => {
		expect(courseTitle(course({ code: 'VEMIMAB144IN' }))).toBe(
			'4 kredit - VEMIMAB144IN'
		);
	});

	it('renders only credits for referencing courses', () => {
		expect(
			courseTitle(course({ code: null, courseBlockReferences: ['_____3'] }))
		).toBe('4 kredit');
	});

	it('omits pseudo codes like ___OPTIONAL___ and ______', () => {
		expect(courseTitle(course({ code: '___OPTIONAL___', credits: 6 }))).toBe('6 kredit');
		expect(courseTitle(course({ code: '______', credits: 0 }))).toBe('0 kredit');
	});

	it('lists prerequisites with parallel marker, matching live output', () => {
		const title = courseTitle(
			course({
				code: 'VEMIMAB346MA',
				credits: 6,
				prerequisites: [
					{
						code: 'VEMIMAB122MA',
						parallel: true,
						name: 'Matematikai alapismeretek',
						paddedId: '000002',
					},
				],
			})
		);
		// Verified byte-for-byte against the live pe.targygraf.hu page.
		expect(title).toBe(
			'6 kredit - VEMIMAB346MA<hr>• Matematikai alapismeretek <u>felvétele</u>'
		);
	});

	it('separates multiple prerequisites with <br>', () => {
		const title = courseTitle(
			course({
				prerequisites: [
					{ code: 'A', parallel: false, name: 'Első', paddedId: '000002' },
					{ code: 'B', parallel: false, name: 'Második', paddedId: '000003' },
				],
			})
		);
		expect(title).toBe('4 kredit - ABC123<hr>• Első<br>• Második');
	});
});

describe('courseBlockDisplayName (CourseBlock::getName port)', () => {
	it('strips the #<n> split suffix', () => {
		expect(courseBlockDisplayName(block({ name: 'Differenciált szakmai tárgy I. #2' }))).toBe(
			'Differenciált szakmai tárgy I.'
		);
	});

	it('keeps ordinary names untouched', () => {
		expect(courseBlockDisplayName(block({ name: '1. félév' }))).toBe('1. félév');
	});

	it('inserts <br /> before newlines, keeping the newline', () => {
		expect(courseBlockDisplayName(block({ name: 'Első sor\nMásodik sor' }))).toBe(
			'Első sor<br />\nMásodik sor'
		);
	});

	it('escapes HTML in names', () => {
		expect(courseBlockDisplayName(block({ name: 'A & B <I>' }))).toBe(
			'A &amp; B &lt;I&gt;'
		);
	});
});

describe('data attributes', () => {
	it('prefixes parallel prerequisites with # (getPrerequisitesIDs)', () => {
		const attr = prerequisitesAttribute(
			course({
				prerequisites: [
					{ code: 'A', parallel: true, name: 'A', paddedId: '000002' },
					{ code: 'B', parallel: false, name: 'B', paddedId: '000003' },
					{ code: '___75___', parallel: false, name: '75 kredit', paddedId: '___75___' },
				],
			})
		);
		expect(attr).toBe('#000002,000003,___75___');
	});

	it('joins block references with commas', () => {
		expect(
			courseBlockReferencesAttribute(course({ courseBlockReferences: ['_____3', '_____4'] }))
		).toBe('_____3,_____4');
	});

	it('renders is_counted as "1"/"0"', () => {
		expect(isCountedAttribute(block({ isCounted: true }))).toBe('1');
		expect(isCountedAttribute(block({ isCounted: false }))).toBe('0');
	});
});

describe('page chrome', () => {
	it('flags curricula from earlier years as outdated', () => {
		const now = new Date('2026-08-30T12:00:00Z');
		expect(isCurriculumOutdated('2014-03-25', now)).toBe(true);
		expect(isCurriculumOutdated('2026-01-01', now)).toBe(false);
	});

	it('appends the site name to page titles', () => {
		expect(pageTitle()).toBe('Tárgygráf');
		expect(pageTitle('Pannon Egyetem')).toBe('Pannon Egyetem | Tárgygráf');
	});
});
