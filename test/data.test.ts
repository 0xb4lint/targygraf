import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	buildProgram,
	findProgram,
	isParallelToken,
	listJsonFiles,
	loadDataset,
	padCourseBlockId,
	padCourseId,
	trimParens,
} from '../src/lib/data';

const FIXTURES = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'fixtures/json'
);

function loadFixtureProgram() {
	const dataset = loadDataset(FIXTURES);
	const aa = dataset.universitiesBySlug.get('aa')!;
	return findProgram(aa, 'proba')!.program;
}

describe('listJsonFiles', () => {
	it('skips dotfiles and returns sorted names', () => {
		const files = listJsonFiles(path.join(FIXTURES, 'universities'));
		expect(files).toEqual(['aa.json', 'bb.json']);
	});
});

describe('padding helpers', () => {
	it('pads course ids with zeros to 6 chars', () => {
		expect(padCourseId(1)).toBe('000001');
		expect(padCourseId(4297)).toBe('004297');
		expect(padCourseId(123456)).toBe('123456');
	});

	it('pads block ids with underscores to 6 chars', () => {
		expect(padCourseBlockId(1)).toBe('_____1');
		expect(padCourseBlockId(574)).toBe('___574');
	});

	it('produces ids that never survive a numeric round-trip', () => {
		// The ids must always behave as strings; the padding guarantees a
		// numeric round-trip is never lossless.
		expect(String(Number(padCourseId(12)))).not.toBe(padCourseId(12));
		expect(Number.isNaN(Number(padCourseBlockId(12)))).toBe(true);
	});
});

describe('prerequisite token parsing', () => {
	it('strips surrounding parentheses from prerequisite tokens', () => {
		expect(trimParens('(ABC123)')).toBe('ABC123');
		expect(trimParens('ABC123')).toBe('ABC123');
		expect(trimParens('___75___')).toBe('___75___');
		expect(trimParens('((ABC123))')).toBe('ABC123');
	});

	it('detects parallel prerequisites from parenthesized tokens', () => {
		expect(isParallelToken('(ABC123)')).toBe(true);
		expect(isParallelToken('ABC123')).toBe(false);
		expect(isParallelToken('___75___')).toBe(false);
	});
});

describe('buildProgram (fixture)', () => {
	const program = loadFixtureProgram();
	const allCourses = program.blocks.flatMap((b) => b.courses);
	const byCode = (code: string) => allCourses.find((c) => c.code === code)!;

	it('parses slugs from the file name', () => {
		expect(program.universitySlug).toBe('aa');
		expect(program.facultySlug).toBe('fk');
		expect(program.slug).toBe('proba');
	});

	it('assigns sequential zero-padded course ids across blocks', () => {
		expect(allCourses.map((c) => c.paddedId)).toEqual(
			Array.from({ length: allCourses.length }, (_, i) => padCourseId(i + 1))
		);
	});

	it('assigns underscore-padded block ids in file order', () => {
		expect(program.blocks.map((b) => b.paddedId)).toEqual([
			'_____1',
			'_____2',
			'_____3',
			'_____4',
			'_____5',
		]);
	});

	it('marks parallel prerequisites', () => {
		const course = byCode('BBB222');
		expect(course.prerequisites).toEqual([
			{
				code: 'AAA111',
				parallel: true,
				name: 'Alapozó tárgy',
				paddedId: '000001',
			},
		]);
	});

	it('resolves credit-gate pseudo prerequisites and orders them first', () => {
		const course = byCode('CCC333');
		// JSON order is [AAA111, ___75___], but the live site listed pivot rows
		// in referenced-course id order: helper credit courses (seeded first)
		// come before program courses. The loader reproduces that.
		expect(course.prerequisites).toEqual([
			{ code: '___75___', parallel: false, name: '75 kredit', paddedId: '___75___' },
			{ code: 'AAA111', parallel: false, name: 'Alapozó tárgy', paddedId: '000001' },
		]);
	});

	it('resolves duplicate codes to the first occurrence', () => {
		const course = byCode('DDD444');
		// Two courses share code AAA111; resolution picks the earliest one
		// in file order, i.e. the one in the first block.
		expect(course.prerequisites[0]!.paddedId).toBe('000001');
		expect(course.prerequisites[0]!.name).toBe('Alapozó tárgy');
	});

	it('resolves course block references by exact name, including "#2" splits', () => {
		const course = allCourses.find((c) => c.code === null)!;
		expect(course.courseBlockReferences).toEqual(['_____3', '_____4']);
	});

	it('defaults is_counted to true and honors explicit false', () => {
		const flags = program.blocks.map((b) => [b.name, b.isCounted]);
		expect(flags).toContainEqual(['Differenciált szakmai tárgy I.', true]);
		expect(flags).toContainEqual(['Differenciált szakmai tárgy I. #2', false]);
		expect(flags).toContainEqual(['1. félév', true]);
	});

	it('sorts blocks by row, keeping file order within a row', () => {
		expect(program.blocks.map((b) => b.row)).toEqual([0, 0, 1, 1, 2]);
		expect(program.blocks[0]!.name).toBe('1. félév');
		expect(program.blocks[1]!.name).toBe('2. félév');
	});

	it('rejects prerequisites that do not exist in the program', () => {
		expect(() =>
			buildProgram(
				'aa_fk_hibas.json',
				{
					name: 'Hibás',
					description: '',
					curriculum_updated_at: null,
					course_blocks: [
						{
							name: '1. félév',
							row: 0,
							courses: [
								{ code: 'X1', name: 'X', credits: 1, prerequisites: ['NEMLETEZO'] },
							],
						},
					],
				},
				'aa_fk_hibas.json'
			)
		).toThrow(/NEMLETEZO/);
	});

	it('rejects credit gate values outside the supported set', () => {
		expect(() =>
			buildProgram(
				'aa_fk_hibas.json',
				{
					name: 'Hibás',
					description: '',
					curriculum_updated_at: null,
					course_blocks: [
						{
							name: '1. félév',
							row: 0,
							courses: [
								{ code: 'X1', name: 'X', credits: 1, prerequisites: ['___60___'] },
							],
						},
					],
				},
				'aa_fk_hibas.json'
			)
		).toThrow(/___60___/);
	});

	it('rejects unresolved course block references', () => {
		expect(() =>
			buildProgram(
				'aa_fk_hibas.json',
				{
					name: 'Hibás',
					description: '',
					curriculum_updated_at: null,
					course_blocks: [
						{
							name: '1. félév',
							row: 0,
							courses: [
								{
									code: null,
									name: 'X',
									credits: 1,
									course_block_references: ['Nincs ilyen blokk'],
								},
							],
						},
					],
				},
				'aa_fk_hibas.json'
			)
		).toThrow(/Nincs ilyen blokk/);
	});
});

describe('loadDataset (fixture)', () => {
	const dataset = loadDataset(FIXTURES);

	it('orders universities by name with Hungarian collation', () => {
		// "Ábel" (bb.json) sorts before "Alfa" (aa.json): Á collates as A on
		// the primary level, and file order would say otherwise.
		expect(dataset.universities.map((u) => u.slug)).toEqual(['bb', 'aa']);
	});

	it('skips hidden files', () => {
		expect(dataset.universitiesBySlug.has('.hidden')).toBe(false);
		expect(dataset.universities).toHaveLength(2);
	});

	it('attaches faculties and programs', () => {
		const aa = dataset.universitiesBySlug.get('aa')!;
		expect(aa.faculties.map((f) => f.slug)).toEqual(['fk']);
		expect(aa.faculties[0]!.programs.map((p) => p.slug)).toEqual(['proba']);
	});

	it('orders programs by name with Hungarian collation', () => {
		const bb = dataset.universitiesBySlug.get('bb')!;
		// "Álma" sorts after "Zéta"? No: hu collation puts Á right after A,
		// well before Z.
		expect(bb.faculties[0]!.programs.map((p) => p.name)).toEqual([
			'Álma Szak',
			'Zéta Szak',
		]);
	});

	it('exposes empty description and null curriculum date as-is', () => {
		const bb = dataset.universitiesBySlug.get('bb')!;
		const zeta = findProgram(bb, 'zeta')!.program;
		expect(zeta.description).toBe('');
		expect(zeta.curriculumUpdatedAt).toBeNull();
	});
});

describe('loadDataset (real repository data)', () => {
	const dataset = loadDataset();

	it('loads every visible university, faculty and program', () => {
		expect(dataset.universities).toHaveLength(13);
		const faculties = dataset.universities.flatMap((u) => u.faculties);
		expect(faculties).toHaveLength(30);
		const programs = faculties.flatMap((f) => f.programs);
		expect(programs).toHaveLength(118);
	});

	it('resolves every prerequisite and block reference without errors', () => {
		// loadDataset would have thrown otherwise; assert some volume so an
		// accidentally-empty parse cannot pass silently.
		const programs = dataset.universities
			.flatMap((u) => u.faculties)
			.flatMap((f) => f.programs);
		const prereqCount = programs
			.flatMap((p) => p.blocks)
			.flatMap((b) => b.courses)
			.reduce((n, c) => n + c.prerequisites.length, 0);
		expect(prereqCount).toBeGreaterThan(3000);
	});

	it('matches the live site for a known course (pe/mernokinformatikus)', () => {
		const pe = dataset.universitiesBySlug.get('pe')!;
		const program = findProgram(pe, 'mernokinformatikus')!.program;
		const courses = program.blocks.flatMap((b) => b.courses);

		const analizis = courses.find((c) => c.code === 'VEMIMAB346MA')!;
		expect(analizis.prerequisites).toHaveLength(1);
		expect(analizis.prerequisites[0]!.parallel).toBe(true);
		expect(analizis.prerequisites[0]!.code).toBe('VEMIMAB122MA');

		const alapismeretek = courses.find((c) => c.code === 'VEMIMAB122MA')!;
		expect(analizis.prerequisites[0]!.paddedId).toBe(alapismeretek.paddedId);
	});

	it('has at least one credit-gate prerequisite in the real data', () => {
		const gates = dataset.universities
			.flatMap((u) => u.faculties)
			.flatMap((f) => f.programs)
			.flatMap((p) => p.blocks)
			.flatMap((b) => b.courses)
			.flatMap((c) => c.prerequisites)
			.filter((p) => /^___\d+___$/.test(p.code));
		expect(gates.length).toBeGreaterThan(0);
		expect(gates.every((g) => g.paddedId === g.code)).toBe(true);
		expect(gates.every((g) => g.name === `${g.code.slice(3, -3)} kredit`)).toBe(true);
	});
});
