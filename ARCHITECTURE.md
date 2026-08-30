# Tárgygráf – architecture (Astro + Cloudflare)

Static replacement for the original Laravel app. The JSON files in
`json/universities`, `json/faculties` and `json/programs` remain the single
source of truth, **unchanged in structure** — the build renders them into
~100 static pages at deploy time. There is no database and no server-side
runtime.

## URLs

The site lives on apex paths; the old per-university subdomains are
permanently redirected:

| Legacy (Laravel)                      | Current                              |
| ------------------------------------- | ------------------------------------ |
| `targygraf.hu`                         | `targygraf.hu`                       |
| `pe.targygraf.hu`                      | `targygraf.hu/pe`                    |
| `pe.targygraf.hu/mernokinformatikus`   | `targygraf.hu/pe/mernokinformatikus` |

## Layout

- `src/lib/data.ts` – build-time port of the Laravel seeders + models
  (slug parsing, padded ids, prerequisite/block-reference resolution,
  live-site prerequisite ordering). Read its header comment before touching
  anything: several oddities (id padding, first-occurrence code resolution,
  prerequisite ordering) are load-bearing for the unmodified frontend.
- `src/pages`, `src/layouts`, `src/components` – 1:1 ports of the Blade
  templates. Every `data-*` attribute is a contract with
  `public/assets/js/targygraf.js`, a dependency-free rewrite of the original
  jQuery frontend (same DOM contract, same localStorage format, quirks
  intentionally preserved — see its header comment). Tooltips reuse the
  original tipsy.css via a small built-in tipsy replacement.
- `worker/` – the Cloudflare Worker. Its only job is 301-ing legacy
  subdomain URLs to apex paths while keeping `/assets/*` and the shared
  static files served on those origins. Apex requests pass straight
  through to static assets. (Progress stored under the legacy subdomain
  origins is not carried over; localStorage is per-origin.)
- `scripts/gen-universities.mjs` – generates the subdomain list for the
  worker (runs automatically via npm scripts; gitignored output).
- `scripts/compare-live.mjs` – structural parity check against the live
  site (used during the migration; useful until the Laravel origin is
  retired).
- `scripts/gen-bulk-redirects.mjs` – emits the frozen legacy-URL redirect
  list as CSV for the optional zero-worker setup (see below).
- `scripts/generate-logo.mjs` – regenerates the outlined brand SVGs in
  `public/assets/img/` (see its header for the font it needs).

## Commands

```sh
npm install
npm run dev        # local dev server (path URLs)
npm test           # all suites; builds into dist-test/ first
npm run build      # build into dist/
npm run preview    # build + wrangler dev
npm run deploy     # build + wrangler deploy
npm run compare-live
```

## Tests (`npm test`)

- `json-validation` – port of the old PHPUnit suite; this is what gates
  contributor PRs (structure, prerequisite/reference resolution, filename
  shape).
- `data` / `render` – loader and presentation units, incl. fixtures and
  live-verified tooltip strings.
- `build-output` – sweeps all built pages: course codes/ids/attributes vs
  the raw JSON (the localStorage contract), links, canonicals, sitemap.
- `runtime-localstorage` – runs the shipped targygraf.js in jsdom against
  built pages with legacy-format localStorage seeded (the assertions were
  validated against the original jQuery engine first, pinning behavioral
  parity); includes booting all 89 program pages.
- `worker-routing` / `worker-e2e` – routing units plus the wrangler-built
  bundle served by Miniflare/workerd with real hostnames.

## Deployment (Cloudflare)

One Worker (`wrangler.jsonc`) serves the static build and handles legacy
redirects. Initial setup on the `targygraf.hu` zone:

1. **Build config** (Workers Builds git integration, or CI running
   `npm run deploy`): build command `npm run build`, deploy command
   `npx wrangler deploy`.
2. **DNS**: keep/ensure proxied records for `targygraf.hu`, `www` and `*`
   (or the 12 university subdomains individually). The routes in
   `wrangler.jsonc` (`targygraf.hu/*`, `*.targygraf.hu/*`) intercept all
   proxied traffic, so the record targets are irrelevant (a placeholder
   `192.0.2.1` / `100::` works; the old VPS can stay until verified).
3. Merges to `master` redeploy automatically when the git integration is
   connected; PRs get preview URLs (path-based URLs work on any host).

### Optional: dropping the Worker later

The worker only exists for the legacy-subdomain redirects. Once those
have soaked long enough:

1. Generate the frozen legacy-URL list:
   `node scripts/gen-bulk-redirects.mjs > cloudflare-bulk-redirects.csv`
   and import it as a **Bulk Redirect List**, or simply create one Single
   Redirect rule: wildcard `https://*.targygraf.hu/*` →
   `https://targygraf.hu/${1}/${2}` (301). (The `_redirects` file cannot do
   this: Workers static assets explicitly do not support domain-level rules.)
2. Remove `main`, `routes` and `run_worker_first` from `wrangler.jsonc`
   (assets-only deploy) and attach `targygraf.hu` as the custom domain.
3. Delete `worker/`.

## Contributor flow (unchanged)

Fork → edit `json/**` → PR to `master`. CI validates the JSON exactly like
the old PHPUnit suite did, then builds the site and runs the full test
matrix. The JSON format is documented in the repository root readme.
