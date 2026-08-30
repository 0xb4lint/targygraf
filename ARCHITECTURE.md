# Tárgygráf – architecture (Astro + Cloudflare)

The site is fully static. The JSON files in `json/universities`,
`json/faculties` and `json/programs` are the single source of truth,
**unchanged in structure since 2012**: the build renders them into ~100
static pages at deploy time. There is no database and no server-side
runtime.

## URLs

The site lives on apex paths; the per-university subdomains it used until
2026 are permanently redirected:

| Legacy (until 2026)                   | Current                              |
| ------------------------------------- | ------------------------------------ |
| `targygraf.hu`                         | `targygraf.hu`                       |
| `pe.targygraf.hu`                      | `targygraf.hu/pe`                    |
| `pe.targygraf.hu/mernokinformatikus`   | `targygraf.hu/pe/mernokinformatikus` |

## Layout

- `src/lib/data.ts` – the build-time data loader (slug parsing, padded ids,
  prerequisite/block-reference resolution, prerequisite ordering). Read its
  header comment before touching anything: several oddities (id padding,
  first-occurrence code resolution, prerequisite ordering) are load-bearing
  frozen contracts with the frontend and with users' stored progress.
- `src/pages`, `src/layouts`, `src/components` – the page templates. Every
  `data-*` attribute is a contract with
  `public/assets/js/targygraf.js`, the dependency-free frontend (frozen DOM
  and localStorage contracts, deliberately preserved quirks; see its header
  comment). Tooltips are rendered by a small built-in helper emitting
  tipsy.css-compatible DOM.
- `worker/` – the Cloudflare Worker. Its only job is 301-ing legacy
  subdomain URLs to apex paths while keeping `/assets/*`, the shared
  static files and the `/__ls-migrate` handoff page served on those
  origins. Apex requests pass straight through to static assets.
- `public/assets/js/ls-migrate.js` + `public/__ls-migrate.html` – the
  one-time localStorage handoff. localStorage is per-origin, so progress
  saved under the legacy subdomains would otherwise be stranded:
  university and program pages embed a hidden iframe to the matching
  legacy origin, whose `/__ls-migrate` page posts the stored progress
  back, and the receiver merges it into the apex origin. A
  `lsMigratedFrom_{university}` flag limits this to one successful
  handoff per subdomain; failed attempts retry on a later visit.
- `scripts/gen-universities.mjs` – generates the subdomain list for the
  worker (runs automatically via npm scripts; gitignored output).
- `scripts/compare-live.mjs` – structural parity check against the live
  site (used during the migration; useful until the cutover to Cloudflare
  is complete).
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

- `json-validation` – gates contributor PRs (structure,
  prerequisite/reference resolution, filename shape).
- `data` / `render` – loader and presentation units, incl. fixtures and
  live-verified tooltip strings.
- `build-output` – sweeps all built pages: course codes/ids/attributes vs
  the raw JSON (the localStorage contract), links, canonicals, sitemap.
- `runtime-localstorage` – runs the shipped targygraf.js in jsdom against
  built pages with localStorage seeded in the format the site has always
  written (the assertions were validated against the pre-2026 engine first,
  pinning behavioral parity); includes booting all 89 program pages.
- `worker-routing` / `worker-e2e` – routing units plus the wrangler-built
  bundle served by Miniflare/workerd with real hostnames.

## Deployment (Cloudflare)

One Worker (`wrangler.jsonc`) serves the static build and handles legacy
redirects.

**Test deploy**: `npm run deploy:test` deploys the same Worker under the
name `targygraf-test` to its workers.dev URL using `wrangler.test.jsonc`,
which carries no zone routes, so it can never touch production traffic.
Path URLs work fully there; only the legacy-subdomain redirects need the
real zone (covered by the Miniflare e2e suite).

Initial setup on the `targygraf.hu` zone:

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

Fork → edit `json/**` → PR to `master`. CI validates the JSON, then builds
the site and runs the full test matrix. The JSON format is documented in
the repository root readme.
