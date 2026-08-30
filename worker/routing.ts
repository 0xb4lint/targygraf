/**
 * Pure routing logic for the Cloudflare Worker.
 *
 * The site lives on apex paths (targygraf.hu/pe/mernokinformatikus). This
 * worker's only real job is the legacy URL space: it permanently redirects
 * the old {university}.targygraf.hu subdomain URLs onto the apex paths.
 *
 * Shared static files (/assets/*, icons, og.png, ...) are excluded from the
 * worker via assets.run_worker_first, so the old origins serve them directly.
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
]);

function isHostIndependent(pathname: string): boolean {
	return (
		pathname.startsWith('/assets/') ||
		pathname.startsWith('/_astro/') || // self-hosted fonts (Astro Fonts API)
		HOST_INDEPENDENT.has(pathname)
	);
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

		// Keep shared static files reachable on the legacy origins.
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
		return {
			kind: 'redirect',
			location: `https://${baseDomain}${targetPath}${url.search}`,
		};
	}

	// Apex domain, workers.dev previews, local dev: the URL space equals the
	// asset layout; let the asset layer serve it (html_handling also takes
	// care of trailing-slash normalization).
	return { kind: 'serve', assetPath: pathname };
}
