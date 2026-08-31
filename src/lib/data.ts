/**
 * Build-time data loader.
 *
 * The JSON files in json/ are the single source of truth and their structure
 * is intentionally unchanged. Everything derived from them here is a frozen
 * contract with the shipped frontend and with the course codes users have
 * kept in localStorage since 2012:
 *
 * - Files whose name starts with '.' or doesn't end in '.json' are skipped,
 *   and files are processed in byte-order sorted filename order (ids derive
 *   from that order).
 * - Slugs come from the filename: universities/{uni}.json,
 *   faculties/{uni}_{faculty}.json, programs/{uni}_{faculty}_{program}.json.
 * - Course ids are zero-padded to 6 characters and course block ids are
 *   underscore-padded to 6 characters. The fixed width matters: the frontend
 *   matches prerequisites with a substring attribute selector over
 *   fixed-width tokens, and padded ids never look purely numeric.
 * - Prerequisite codes are resolved against the FIRST course in the same
 *   program with a matching code -- duplicate codes within a program are
 *   common in the data.
 * - '(CODE)' marks a parallel ("felvehető egyidejűleg") prerequisite and is
 *   rendered as '#'-prefixed id in data-prerequisites.
 * - '___<n>___' pseudo-courses ("n teljesített kredit") are global helper
 *   rows; their padded id is the code itself and their display name is
 *   '<n> kredit'.
 * - course_block_references are resolved by exact block name within the
 *   program (first match).
 * - is_counted defaults to true unless the JSON says exactly false.
 */
import fs from 'node:fs';
import path from 'node:path';

import { JSON_ROOT } from './paths';

/** The only credit-gate pseudo-courses that exist; anything else is invalid. */
export const DUMMY_CREDIT_COURSE_CODES = [
	'___20___',
	'___40___',
	'___45___',
	'___50___',
	'___75___',
	'___120___',
	'___130___',
	'___150___',
] as const;

export const OPTIONAL_COURSE_CODE = '___OPTIONAL___';
export const SEPARATOR_COURSE_CODE = '______';

const DUMMY_CREDIT_REGEX = /^___\d+___$/;

export interface Prerequisite {
	/** Course code with surrounding parentheses removed. */
	code: string;
	/** True when the JSON wrapped the code in parentheses. */
	parallel: boolean;
	/** Display name of the referenced course ('<n> kredit' for credit gates). */
	name: string;
	/**
	 * Token used in the data-prerequisites attribute: the referenced course's
	 * padded id, or the ___<n>___ code itself for credit gates.
	 */
	paddedId: string;
}

export interface Course {
	paddedId: string;
	code: string | null;
	name: string | null;
	credits: number;
	prerequisites: Prerequisite[];
	/** Padded ids of the referenced course blocks. */
	courseBlockReferences: string[];
}

export interface CourseBlock {
	paddedId: string;
	/** Raw block name from JSON (unique key for references, may end in ' #2'). */
	name: string;
	row: number;
	isCounted: boolean;
	courses: Course[];
}

export interface Program {
	slug: string;
	universitySlug: string;
	facultySlug: string;
	name: string;
	description: string;
	curriculumUpdatedAt: string | null;
	/** Blocks in display order: stable-sorted by row (CourseBlock relation). */
	blocks: CourseBlock[];
}

export interface Faculty {
	slug: string;
	universitySlug: string;
	name: string;
	/** Position on the university page (the JSON ordering field). */
	ordering: number;
	/** Programs ordered by name (Hungarian collation). */
	programs: Program[];
}

export interface University {
	slug: string;
	name: string;
	hasLogo: boolean;
	/** Faculties in curated order (ordering field; file order breaks ties). */
	faculties: Faculty[];
}

export interface Dataset {
	/** Universities ordered by name (Hungarian collation). */
	universities: University[];
	universitiesBySlug: Map<string, University>;
}

/** Skip dotfiles and non-.json files; process in byte-order sorted order. */
export function listJsonFiles(directory: string): string[] {
	return fs
		.readdirSync(directory)
		.filter((file) => file[0] !== '.' && file.endsWith('.json'))
		.sort();
}

function readJson(filePath: string): any {
	const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
	if (parsed === null || typeof parsed !== 'object') {
		throw new Error(`${filePath}: expected a JSON object`);
	}
	return parsed;
}

/** Left-pad a course id to 6 characters with zeros. */
export function padCourseId(id: number): string {
	return String(id).padStart(6, '0');
}

/** Left-pad a course block id to 6 characters with underscores. */
export function padCourseBlockId(id: number): string {
	return String(id).padStart(6, '_');
}

/** Strip leading and trailing parentheses from a prerequisite token. */
export function trimParens(token: string): string {
	return token.replace(/^[()]+/, '').replace(/[()]+$/, '');
}

/** A fully parenthesized token marks a parallel prerequisite. */
export function isParallelToken(token: string): boolean {
	return /^\(.+\)$/.test(token);
}

export function isDummyCreditCode(code: string): boolean {
	return DUMMY_CREDIT_REGEX.test(code);
}

/**
 * Universities and programs are listed by name using the Hungarian locale.
 */
const nameCollator = new Intl.Collator('hu', { sensitivity: 'variant' });

export function buildProgram(
	fileName: string,
	raw: any,
	filePath: string
): Program {
	const nameParts = path.basename(fileName, '.json').split('_');
	const [universitySlug, facultySlug, slug] = nameParts;

	let courseSequence = 0;
	const blocks: CourseBlock[] = raw.course_blocks.map(
		(rawBlock: any, blockIndex: number): CourseBlock => ({
			paddedId: padCourseBlockId(blockIndex + 1),
			name: rawBlock.name,
			row: rawBlock.row,
			// Counted unless the JSON says exactly false.
			isCounted: rawBlock.is_counted !== false,
			courses: rawBlock.courses.map(
				(rawCourse: any): Course => ({
					paddedId: padCourseId(++courseSequence),
					code: rawCourse.code ?? null,
					name: rawCourse.name ?? null,
					credits: rawCourse.credits,
					prerequisites: [],
					courseBlockReferences: [],
				})
			),
		})
	);

	// First-occurrence lookup maps: duplicates resolve to the earliest entry.
	const courseByCode = new Map<string, Course>();
	const blockByName = new Map<string, CourseBlock>();
	for (const block of blocks) {
		if (!blockByName.has(block.name)) {
			blockByName.set(block.name, block);
		}
		for (const course of block.courses) {
			if (course.code !== null && !courseByCode.has(course.code)) {
				courseByCode.set(course.code, course);
			}
		}
	}

	// Prerequisite order is a frozen rendering contract (tooltip text and
	// data attributes follow it): the ___n___ credit gates come first, in
	// DUMMY_CREDIT_COURSE_CODES order, then program courses in file-position
	// order. This is the order the site has always displayed.
	const prerequisiteSortKey = (p: Prerequisite): number =>
		isDummyCreditCode(p.code)
			? DUMMY_CREDIT_COURSE_CODES.indexOf(p.code as any) - DUMMY_CREDIT_COURSE_CODES.length
			: parseInt(p.paddedId, 10);

	// Second pass: resolve prerequisites and block references.
	for (const [blockIndex, block] of blocks.entries()) {
		for (const [courseIndex, course] of block.courses.entries()) {
			const rawCourse = raw.course_blocks[blockIndex].courses[courseIndex];

			for (const token of rawCourse.prerequisites ?? []) {
				const code = trimParens(token);
				const parallel = isParallelToken(token);

				if (isDummyCreditCode(code)) {
					if (!(DUMMY_CREDIT_COURSE_CODES as readonly string[]).includes(code)) {
						throw new Error(
							`${filePath}: unknown credit prerequisite ${code} ` +
								`(only ${DUMMY_CREDIT_COURSE_CODES.join(', ')} exist)`
						);
					}
					course.prerequisites.push({
						code,
						parallel,
						name: `${code.slice(3, -3)} kredit`,
						paddedId: code,
					});
					continue;
				}

				const target = courseByCode.get(code);
				if (!target) {
					throw new Error(`${filePath}: prerequisite ${code} not found in program`);
				}
				course.prerequisites.push({
					code,
					parallel,
					name: target.name ?? '',
					paddedId: target.paddedId,
				});
			}

			for (const referenceName of rawCourse.course_block_references ?? []) {
				const target = blockByName.get(referenceName);
				if (!target) {
					throw new Error(
						`${filePath}: course_block_reference "${referenceName}" not found in program`
					);
				}
				course.courseBlockReferences.push(target.paddedId);
			}

			// Same clustered-index effect as prerequisites (see above).
			course.prerequisites.sort(
				(a, b) => prerequisiteSortKey(a) - prerequisiteSortKey(b)
			);
			course.courseBlockReferences.sort(
				(a, b) => parseInt(a.replace(/_/g, ''), 10) - parseInt(b.replace(/_/g, ''), 10)
			);
		}
	}

	// Display order: stable sort by row; within a row, file order is kept.
	const sortedBlocks = [...blocks].sort((a, b) => a.row - b.row);

	return {
		slug,
		universitySlug,
		facultySlug,
		name: raw.name,
		description: raw.description,
		curriculumUpdatedAt: raw.curriculum_updated_at ?? null,
		blocks: sortedBlocks,
	};
}

export function loadDataset(jsonRoot: string = JSON_ROOT): Dataset {
	const universities: University[] = [];
	const universitiesBySlug = new Map<string, University>();
	const facultiesByKey = new Map<string, Faculty>();

	for (const file of listJsonFiles(path.join(jsonRoot, 'universities'))) {
		const raw = readJson(path.join(jsonRoot, 'universities', file));
		const university: University = {
			slug: path.basename(file, '.json'),
			name: raw.name,
			hasLogo: Boolean(raw.has_logo),
			faculties: [],
		};
		universities.push(university);
		universitiesBySlug.set(university.slug, university);
	}

	for (const file of listJsonFiles(path.join(jsonRoot, 'faculties'))) {
		const raw = readJson(path.join(jsonRoot, 'faculties', file));
		const [universitySlug, slug] = path.basename(file, '.json').split('_');
		const university = universitiesBySlug.get(universitySlug);
		if (!university) {
			throw new Error(`faculties/${file}: university "${universitySlug}" not found`);
		}
		const faculty: Faculty = {
			slug,
			universitySlug,
			name: raw.name,
			ordering: raw.ordering,
			programs: [],
		};
		university.faculties.push(faculty);
		facultiesByKey.set(`${universitySlug}_${slug}`, faculty);
	}

	for (const file of listJsonFiles(path.join(jsonRoot, 'programs'))) {
		const filePath = path.join(jsonRoot, 'programs', file);
		const program = buildProgram(file, readJson(filePath), filePath);
		const faculty = facultiesByKey.get(`${program.universitySlug}_${program.facultySlug}`);
		if (!faculty) {
			throw new Error(
				`programs/${file}: faculty "${program.universitySlug}_${program.facultySlug}" not found`
			);
		}
		faculty.programs.push(program);
	}

	// Universities and programs are listed alphabetically by name; faculties
	// keep the curated order of their JSON ordering field (stable sort, so
	// file order breaks ties).
	universities.sort((a, b) => nameCollator.compare(a.name, b.name));

	for (const university of universities) {
		university.faculties.sort((a, b) => a.ordering - b.ordering);
		for (const faculty of university.faculties) {
			faculty.programs.sort((a, b) => nameCollator.compare(a.name, b.name));
		}
	}

	return { universities, universitiesBySlug };
}

let cachedDataset: Dataset | null = null;

/** Cached accessor used by the Astro pages (build-time only). */
export function getDataset(): Dataset {
	cachedDataset ??= loadDataset();
	return cachedDataset;
}

export function findProgram(
	university: University,
	programSlug: string
): { faculty: Faculty; program: Program } | null {
	// ProgramController iterates faculties/programs and picks the first match.
	for (const faculty of university.faculties) {
		for (const program of faculty.programs) {
			if (program.slug === programSlug) {
				return { faculty, program };
			}
		}
	}
	return null;
}
