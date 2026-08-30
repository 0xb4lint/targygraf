import { defineConfig } from 'astro/config';

// URL_MODE=subdomain builds the production site with absolute
// https://{university}.targygraf.hu links (the URL scheme the Laravel app
// used). The default, path mode, builds host-relative /{university}/... links
// so previews and local dev work on a single hostname.
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
