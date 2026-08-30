/**
 * URL generation. The Laravel app routed on subdomains in production
 * ({university}.targygraf.hu[/{program}]) and fell back to path prefixes
 * locally. The static build supports the same two modes:
 *
 * - subdomain (production): absolute https URLs, preserving every URL the
 *   live site has today. Requires the Cloudflare Worker in worker/ for
 *   host-based routing, plus a wildcard DNS record.
 * - path (default; local dev, previews): host-relative /{university} and
 *   /{university}/{program} links, matching the physical layout of the
 *   build output, so the site works on any single hostname.
 */
export type UrlMode = 'subdomain' | 'path';

export interface UrlConfig {
	mode: UrlMode;
	domain: string;
}

export function getUrlConfig(env: Record<string, string | undefined> = process.env): UrlConfig {
	const mode = env.URL_MODE === 'subdomain' ? 'subdomain' : 'path';
	return { mode, domain: env.SITE_DOMAIN || 'targygraf.hu' };
}

export function homeUrl(config: UrlConfig): string {
	return config.mode === 'subdomain' ? `https://${config.domain}` : '/';
}

export function universityUrl(config: UrlConfig, universitySlug: string): string {
	return config.mode === 'subdomain'
		? `https://${universitySlug}.${config.domain}`
		: `/${universitySlug}`;
}

export function programUrl(
	config: UrlConfig,
	universitySlug: string,
	programSlug: string
): string {
	return config.mode === 'subdomain'
		? `https://${universitySlug}.${config.domain}/${programSlug}`
		: `/${universitySlug}/${programSlug}`;
}

/** Absolute origin of a university's pages, used for og: meta tags. */
export function universityOrigin(config: UrlConfig, universitySlug: string): string {
	return config.mode === 'subdomain'
		? `https://${universitySlug}.${config.domain}`
		: '';
}

export function rootOrigin(config: UrlConfig): string {
	return config.mode === 'subdomain' ? `https://${config.domain}` : '';
}
