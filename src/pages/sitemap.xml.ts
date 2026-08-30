import type { APIRoute } from 'astro';

import { getDataset } from '../lib/data';
import { canonicalUrl, programPath, universityPath } from '../lib/urls';

export const GET: APIRoute = () => {
	const { universities } = getDataset();

	const urls: string[] = [canonicalUrl('/'), canonicalUrl('/adatvedelem')];
	for (const university of universities) {
		urls.push(canonicalUrl(universityPath(university.slug)));
		for (const faculty of university.faculties) {
			for (const program of faculty.programs) {
				urls.push(canonicalUrl(programPath(university.slug, program.slug)));
			}
		}
	}

	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls.map((url) => `\t<url><loc>${url}</loc></url>`).join('\n') +
		'\n</urlset>\n';

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
};
