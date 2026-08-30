/**
 * Presentation helpers. The exact output strings are frozen contracts with
 * the shipped frontend (tooltips, data attributes), so change with care.
 */
import type { Course, CourseBlock } from './data';

const ANY_PSEUDO_CODE_REGEX = /^___.*___$/;

/**
 * The tooltip content. Returns an HTML string; it goes through an Astro
 * `title={...}` expression, which escapes it into the title attribute (the
 * tooltip code reads it back and renders it as HTML).
 */
export function courseTitle(course: Course): string {
	let title = `${course.credits} kredit`;

	if (course.courseBlockReferences.length) {
		return title;
	}

	if (course.code && !ANY_PSEUDO_CODE_REGEX.test(course.code)) {
		title += ` - ${course.code}`;
	}

	if (course.prerequisites.length) {
		title += '<hr>';
	}

	course.prerequisites.forEach((prerequisite, i) => {
		if (i) {
			title += '<br>';
		}
		title += `• ${prerequisite.name}`;
		if (prerequisite.parallel) {
			title += ' <u>felvétele</u>';
		}
	});

	return title;
}

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Block display name: strip the '#<n>' disambiguation suffix used by split
 * referenceable blocks, then turn newlines into <br /> for multi-line block
 * titles. The result is inserted as HTML, so escape before adding the tags.
 */
export function courseBlockDisplayName(block: CourseBlock): string {
	const withoutSuffix = block.name.replace(/\s*#\d+$/, '');
	// Insert '<br />' before each newline, keeping the newline itself.
	return escapeHtml(withoutSuffix).replace(/(\r\n|\n\r|\r|\n)/g, '<br />$1');
}

/** data-prerequisites attribute: padded ids, '#'-prefixed when parallel. */
export function prerequisitesAttribute(course: Course): string {
	return course.prerequisites
		.map((p) => (p.parallel ? `#${p.paddedId}` : p.paddedId))
		.join(',');
}

/** data-referenced-course-blocks attribute. */
export function courseBlockReferencesAttribute(course: Course): string {
	return course.courseBlockReferences.join(',');
}

/** Rendered as "1"/"0"; the frontend checks != "0". */
export function isCountedAttribute(block: CourseBlock): string {
	return block.isCounted ? '1' : '0';
}

/**
 * A curriculum is flagged as outdated when its year is before the current
 * year. Build-time evaluation; the site is rebuilt on every merge so this
 * stays fresh enough.
 */
export function isCurriculumOutdated(
	curriculumUpdatedAt: string,
	now: Date = new Date()
): boolean {
	return parseInt(curriculumUpdatedAt.slice(0, 4), 10) < now.getFullYear();
}

/** Page title: the page-specific part plus the site name. */
export function pageTitle(htmlTitle?: string): string {
	return htmlTitle ? `${htmlTitle} | Tárgygráf` : 'Tárgygráf';
}

export const DEFAULT_DESCRIPTION = 'Interaktív tanulmányi előrehaladás vizualizáció';
