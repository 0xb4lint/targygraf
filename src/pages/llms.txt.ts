import type { APIRoute } from 'astro';

import { getDataset } from '../lib/data';
import { canonicalUrl, programPath, universityPath } from '../lib/urls';

/**
 * https://llmstxt.org/ : a concise, markdown-shaped map of the site for
 * language models, generated from the dataset like the sitemap.
 */
export const GET: APIRoute = () => {
	const { universities } = getDataset();

	const lines: string[] = [
		'# Tárgygráf',
		'',
		'> Interaktív mintatanterv magyar egyetemi szakokhoz, 2012 óta. A hallgató bejelöli, mit teljesített, a gráf pedig megmutatja, mit vehet fel, minek mi az előfeltétele, és hogyan épülnek egymásra a tárgyak félévről félévre.',
		'',
		'Az oldal statikus és regisztráció nélkül működik: a haladás a böngésző helyi tárolójában marad. A tantervek JSON fájlok egy nyílt GitHub repóban, hallgatói pull requestekkel szerkeszthetők. Egy tantervoldal címe: https://targygraf.hu/{egyetem}/{szak}.',
		'',
		'## Egyetemek',
		'',
	];

	for (const university of universities) {
		const programCount = university.faculties.reduce(
			(n, faculty) => n + faculty.programs.length,
			0
		);
		lines.push(
			`- [${university.name}](${canonicalUrl(universityPath(university.slug))}): ` +
				`${university.faculties.length} kar, ${programCount} szak`
		);
	}

	lines.push('', '## Tantervek', '');
	for (const university of universities) {
		for (const faculty of university.faculties) {
			for (const program of faculty.programs) {
				lines.push(
					`- [${university.slug.toUpperCase()} ${program.name}]` +
						`(${canonicalUrl(programPath(university.slug, program.slug))}): ` +
						`${program.description}`
				);
			}
		}
	}

	lines.push(
		'',
		'## Projekt',
		'',
		'- [GitHub repó](https://github.com/0xb4lint/targygraf): a tantervek forrása és a közreműködés útmutatója',
		`- [Adatkezelési tájékoztató](${canonicalUrl('/adatvedelem')}): mit tárol az oldal a böngészőben, és hogyan kapcsolható ki a látogatottságmérés`,
		''
	);

	return new Response(lines.join('\n'), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
