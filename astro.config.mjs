import { defineConfig } from 'astro/config';

// Links are host-relative (/pe, /pe/mernokinformatikus) so the same build
// works in production, previews and local dev. Absolute URLs (canonical,
// og:*, sitemap) use SITE_ORIGIN (default https://targygraf.hu).
export default defineConfig({
	output: 'static',
	outDir: process.env.OUT_DIR || './dist',
	build: {
		// Emit /pe.html instead of /pe/index.html so Cloudflare's static asset
		// serving (html_handling: auto-trailing-slash) keeps the current
		// slash-less URLs (pe.targygraf.hu/mernokinformatikus) without redirects.
		format: 'file',
	},
	trailingSlash: 'never',
	site: 'https://targygraf.hu',
});
