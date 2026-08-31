/**
 * Pure routing logic for the Cloudflare Worker.
 *
 * The site lives on apex paths (targygraf.hu/pe/mernokinformatikus). This
 * worker's only real job is the legacy URL space: it permanently redirects
 * the old {university}.targygraf.hu subdomain URLs onto the apex paths.
 *
 * Shared static files (/assets/*, icons, og.png, ...) and the /__migrate
 * page are excluded from the worker via assets.run_worker_first, so the old
 * origins keep serving them directly; /__migrate is what hands over the
 * localStorage saved under the old subdomain origins (see
 * public/assets/js/migrate.js).
 *
 * It also 301s program pages that have changed slug (RENAMED_PROGRAMS). That
 * list is not frozen the way the subdomain space is: the year-less slug always
 * holds the current curriculum, so publishing a new one renames the page that
 * held it (see ARCHITECTURE.md).
 */

export type RouteDecision =
	| { kind: 'serve'; assetPath: string }
	| { kind: 'redirect'; location: string };

/** Files served identically on every host (also excluded via run_worker_first). */
const HOST_INDEPENDENT = new Set([
	'/icon.png',
	'/favicon.ico',
	'/favicon.svg',
	'/favicon-32.png',
	'/apple-touch-icon.png',
	'/og.png',
	'/robots.txt',
	'/sitemap.xml',
	'/__migrate',
]);

function isHostIndependent(pathname: string): boolean {
	return (
		pathname.startsWith('/assets/') ||
		pathname.startsWith('/_astro/') || // self-hosted fonts (Astro Fonts API)
		HOST_INDEPENDENT.has(pathname)
	);
}

/**
 * Program pages whose slug changed, oldest path -> current path. A rename
 * happens when a newer curriculum takes over the year-less slug and the page
 * that held it moves to a year-suffixed one; without an entry here the old URL
 * would simply 404.
 */
const RENAMED_PROGRAMS = new Map<string, string>([
	['/bme/mernok-informatikusmsc2023', '/bme/mernok-informatikusmsc'],
]);

/** The current path for a program page, or null if the slug never moved. */
function renamedProgram(pathname: string): string | null {
	const clean = pathname.replace(/\.html$/, '');
	return RENAMED_PROGRAMS.get(clean) ?? null;
}

function stripTrailingSlash(pathname: string): string {
	return pathname !== '/' && pathname.endsWith('/')
		? pathname.replace(/\/+$/, '')
		: pathname;
}

export function route(
	url: URL,
	baseDomain: string,
	universities: readonly string[]
): RouteDecision {
	const host = url.hostname.toLowerCase();
	const pathname = url.pathname;

	if (host.endsWith(`.${baseDomain}`)) {
		const subdomain = host.slice(0, -(baseDomain.length + 1));

		// Keep the localStorage handoff page and shared static files
		// reachable on the legacy origins.
		if (isHostIndependent(pathname)) {
			return { kind: 'serve', assetPath: pathname };
		}

		// {university}.targygraf.hu[/...] -> targygraf.hu/{university}[/...]
		// www and unknown subdomains -> same path on the apex.
		const cleanPath = stripTrailingSlash(pathname);
		let targetPath: string;
		if (universities.includes(subdomain)) {
			targetPath = cleanPath === '/' ? `/${subdomain}` : `/${subdomain}${cleanPath}`;
		} else {
			targetPath = cleanPath;
		}
		// A legacy URL for a since-renamed program lands on its current page in
		// one hop rather than bouncing through the old apex path.
		targetPath = renamedProgram(targetPath) ?? targetPath;
		return {
			kind: 'redirect',
			location: `https://${baseDomain}${targetPath}${url.search}`,
		};
	}

	const renamed = renamedProgram(stripTrailingSlash(pathname));
	if (renamed) {
		return { kind: 'redirect', location: `https://${baseDomain}${renamed}${url.search}` };
	}

	// Apex domain, workers.dev previews, local dev: the URL space equals the
	// asset layout; let the asset layer serve it (html_handling also takes
	// care of trailing-slash normalization).
	return { kind: 'serve', assetPath: pathname };
}
