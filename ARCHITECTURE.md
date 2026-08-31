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

### Program slug versioning

A program keeps one slug per curriculum, and **the slug without a year is
always the current one**; superseded curricula take a year suffix:

```
/bme/mernok-informatikus        2024-09-01, the curriculum in force
/bme/mernok-informatikus2022    2022 intake
/bme/mernok-informatikus2014    2014 intake
/bme/mernok-informatikus2013    pre-2014 intake
```

The `name` field follows the slug: the current curriculum carries the plain
programme name (`Mérnökinformatikus`) and the archived ones name their intake
(`Mérnökinformatikus (2022-től felvetteknek)`), so the program selector reads
as one current entry plus its history.

Publishing a new curriculum therefore *renames* the previous file and gives
the bare slug to the new one, rather than parking the newest behind a year.
The most-linked and best-indexed URL then always answers the question almost
every visitor is actually asking. The cost is that the bare slug's content
moves over time, so a student who wants a link that keeps pointing at *their*
curriculum should use the year-suffixed one.

Two caveats:

- There is no per-program redirect (the Worker's legacy map is frozen at
  migration time, see `worker/routing.ts`), so renaming a slug that is already
  deployed turns it into a 404. Renumbering is safe when the bare slug keeps
  existing and only never-deployed slugs disappear.
- `bme_vik_mernok-informatikusmsc2023` is the one program that does not follow
  the rule: it is the newest (and only) curriculum of its family, but it
  shipped with the year in its slug, and dropping the suffix would 404 the
  live URL. Fixing it needs a redirect first.

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
  static files and the `/__migrate` handoff page served on those
  origins. Apex requests pass straight through to static assets.
- `public/assets/js/migrate.js` + `public/__migrate.html` – the
  one-time localStorage handoff. localStorage is per-origin, so progress
  saved under the legacy subdomains would otherwise be stranded.
  University and program pages carry it over with two transports: a
  hidden same-site iframe whose `/__migrate` page posts the stored
  progress back (Chrome/Firefox), and a one-time top-level bounce
  through the same page returning a `#tgm=` fragment for WebKit
  browsers, which partition iframe storage even for same-site
  subdomains (Safari and every iOS browser; detected by the Apple
  vendor string). A `migrated_{university}` flag limits this to one
  successful handoff per subdomain; failed attempts retry later, and
  the fragment is only accepted with a same-session bounce guard so a
  crafted link cannot inject data.
- `scripts/gen-universities.mjs` – generates the subdomain list for the
  worker (runs automatically via npm scripts; gitignored output).
- `scripts/compare-live.mjs` – structural parity check against the live
  site (used during the migration; useful until the cutover to Cloudflare
  is complete).
- `scripts/gen-bulk-redirects.mjs` – emits the frozen legacy-URL redirect
  list as CSV for the optional zero-worker setup (see below).
- `scripts/generate-logo.mjs` – regenerates the outlined brand SVGs in
  `public/assets/img/` (see its header for the font it needs).

## Storage model

localStorage keeps the 2012 format on purpose: `coursesFinished` /
`coursesProcessing` (JSON arrays of course codes) and `creditsOptional`
(number). A course code is treated as a university-agnostic fact about
the student, and unknown codes are always preserved on save, so the flat
format is forward-safe: a future format could migrate in-page losslessly.

What changed with the move to apex paths is the scope, not the format:
storage used to be per university subdomain, now one origin serves every
university. This is sound because codes do not collide across
institutions (4002 distinct codes, zero cross-university collisions in
the data; each university's code scheme is its own namespace). Known,
accepted edges:

- `creditsOptional` is a single global number (it was per-university
  before); after migrating from several subdomains the first value wins.
- A handful of placeholder courses share the empty-string code
  (Testnevelés, Szakdolgozat); marking one can cosmetically mark the
  others, a quirk the site has always had within a university. The
  migration bridge drops empty codes.

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

- `json-validation` – gates contributor PRs: structure, unknown-field
  (typo) detection, prerequisite/reference resolution, filename shape,
  plus a full loader pass. Failure messages are contributor-facing
  Hungarian sentences naming the file, the spot and the fix.
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

**Production deploys are automatic**: every push to `master` that passes
the test job also runs the deploy job in `.github/workflows/test.yml`
(`npm run deploy` = build + `wrangler deploy`, which uploads the assets
and attaches the `targygraf.hu` zone routes). Contributor PRs only run
the tests; fork PRs have no access to the deploy secret.

One-time setup:

1. **API token**: create one at dash.cloudflare.com/profile/api-tokens
   with the "Edit Cloudflare Workers" template (covers Workers scripts
   and the zone routes), then store it as the repository secret:
   `gh secret set CLOUDFLARE_API_TOKEN`. The `account_id` is committed in
   `wrangler.jsonc`.
2. **DNS**: keep/ensure proxied records for `targygraf.hu`, `www` and `*`
   (or the 12 university subdomains individually). The routes in
   `wrangler.jsonc` (`targygraf.hu/*`, `*.targygraf.hu/*`) intercept all
   proxied traffic, so the record targets are irrelevant (a placeholder
   `192.0.2.1` / `100::` works; the old VPS can stay until verified).

**The first `master` deploy is the cutover**: DNS is already proxied, so
the moment the routes attach, both the apex and the legacy subdomains are
served by the Worker instead of the old origin. Rollback is instant:
delete the two routes in the dashboard and traffic returns to the origin.

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
