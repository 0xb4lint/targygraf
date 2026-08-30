/**
 * Presentation helpers ported from the Eloquent models and Blade templates.
 */
import type { Course, CourseBlock } from './data';

const ANY_PSEUDO_CODE_REGEX = /^___.*___$/;

/**
 * Course::getTitle() -- the tipsy tooltip content. Returns an HTML string;
 * the Blade template emitted it through an escaped echo into the title
 * attribute, which is exactly what an Astro `title={...}` expression does.
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
 * CourseBlock::getName(): strip the '#<n>' disambiguation suffix used by
 * split referenceable blocks, then nl2br() for multi-line block titles.
 * The Blade template printed the result unescaped ({!! !!}); block names come
 * from reviewed JSON, but we escape before inserting the <br /> tags anyway.
 */
export function courseBlockDisplayName(block: CourseBlock): string {
	const withoutSuffix = block.name.replace(/\s*#\d+$/, '');
	// PHP nl2br(): insert '<br />' before the newline, keeping the newline.
	return escapeHtml(withoutSuffix).replace(/(\r\n|\n\r|\r|\n)/g, '<br />$1');
}

/** data-prerequisites attribute (Course::getPrerequisitesIDs + implode). */
export function prerequisitesAttribute(course: Course): string {
	return course.prerequisites
		.map((p) => (p.parallel ? `#${p.paddedId}` : p.paddedId))
		.join(',');
}

/** data-referenced-course-blocks attribute. */
export function courseBlockReferencesAttribute(course: Course): string {
	return course.courseBlockReferences.join(',');
}

/** Blade printed the MySQL boolean as 1/0. The frontend checks != "0". */
export function isCountedAttribute(block: CourseBlock): string {
	return block.isCounted ? '1' : '0';
}

/**
 * layouts/program.blade.php: a curriculum is flagged as outdated when its
 * year is before the current year. Build-time evaluation; the site is
 * rebuilt on every merge so this stays fresh enough.
 */
export function isCurriculumOutdated(
	curriculumUpdatedAt: string,
	now: Date = new Date()
): boolean {
	return parseInt(curriculumUpdatedAt.slice(0, 4), 10) < now.getFullYear();
}

/** Blade template.blade.php title logic. */
export function pageTitle(htmlTitle?: string): string {
	return htmlTitle ? `${htmlTitle} | Tárgygráf` : 'Tárgygráf';
}

export const DEFAULT_DESCRIPTION = 'Interaktív tanulmányi előrehaladás vizualizáció';
