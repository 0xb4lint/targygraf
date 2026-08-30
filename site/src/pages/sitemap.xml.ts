import type { APIRoute } from 'astro';

import { getDataset } from '../lib/data';
import { getUrlConfig, programUrl, universityUrl } from '../lib/urls';

/**
 * One sitemap served from the apex domain. In subdomain mode the entries
 * point at the university subdomains (cross-host entries are fine for
 * crawlers when the hosts share the registrable domain and the sitemap is
 * referenced from robots.txt).
 */
export const GET: APIRoute = () => {
	const config = getUrlConfig();
	const { universities } = getDataset();

	const absolute = (url: string) =>
		url.startsWith('https://') ? url : `https://${config.domain}${url === '/' ? '' : url}`;

	const urls: string[] = [`https://${config.domain}/`];
	for (const university of universities) {
		urls.push(absolute(universityUrl(config, university.slug)));
		for (const faculty of university.faculties) {
			for (const program of faculty.programs) {
				urls.push(absolute(programUrl(config, university.slug, program.slug)));
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
