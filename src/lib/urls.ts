/**
 * URL generation. The site consolidates the old {university}.targygraf.hu
 * subdomains onto apex paths:
 *
 *   /                      home
 *   /{university}          university page
 *   /{university}/{program} program page
 *
 * Links are host-relative so the same build works in production, previews
 * and local dev. Absolute URLs (canonical, og:*, sitemap) always point at
 * the production origin. The Cloudflare Worker 301-redirects the legacy
 * subdomain URLs onto these paths.
 */

export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
	return (env.SITE_ORIGIN || 'https://targygraf.hu').replace(/\/+$/, '');
}

export function homePath(): string {
	return '/';
}

export function universityPath(universitySlug: string): string {
	return `/${universitySlug}`;
}

export function programPath(universitySlug: string, programSlug: string): string {
	return `/${universitySlug}/${programSlug}`;
}

/** Absolute canonical URL for a path ('/' canonicalizes to the bare origin + '/'). */
export function canonicalUrl(path: string, origin: string = siteOrigin()): string {
	return path === '/' ? `${origin}/` : `${origin}${path}`;
}
