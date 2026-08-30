import { defineConfig, fontProviders } from 'astro/config';

// Links are host-relative (/pe, /pe/mernokinformatikus) so the same build
// works in production, previews and local dev. Absolute URLs (canonical,
// og:*, sitemap) use SITE_ORIGIN (default https://targygraf.hu).
export default defineConfig({
	output: 'static',
	outDir: process.env.OUT_DIR || './dist',
	// Self-hosted via the Fonts API: downloaded at build time, served from
	// /_astro/fonts (no request to Google at runtime). latin-ext is required
	// for the Hungarian ő/ű. style.css maps these onto its own tokens.
	fonts: [
		{
			name: 'IBM Plex Sans',
			cssVariable: '--font-body',
			provider: fontProviders.google(),
			weights: [400, 500, 600],
			styles: ['normal'],
			subsets: ['latin', 'latin-ext'],
			fallbacks: ['Segoe UI', 'sans-serif'],
		},
		{
			name: 'IBM Plex Sans Condensed',
			cssVariable: '--font-display',
			provider: fontProviders.google(),
			weights: [600, 700],
			styles: ['normal'],
			subsets: ['latin', 'latin-ext'],
			fallbacks: ['Arial Narrow', 'sans-serif'],
		},
		{
			name: 'IBM Plex Mono',
			cssVariable: '--font-mono',
			provider: fontProviders.google(),
			weights: [400, 500],
			styles: ['normal'],
			subsets: ['latin', 'latin-ext'],
			fallbacks: ['Courier New', 'monospace'],
		},
	],
	build: {
		// Emit /pe.html instead of /pe/index.html so Cloudflare's static asset
		// serving (html_handling: auto-trailing-slash) keeps the current
		// slash-less URLs (pe.targygraf.hu/mernokinformatikus) without redirects.
		format: 'file',
	},
	trailingSlash: 'never',
	site: 'https://targygraf.hu',
});
