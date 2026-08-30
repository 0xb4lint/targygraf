# CLAUDE.md

Tárgygráf ([targygraf.hu](https://targygraf.hu)): interactive curriculum
maps for Hungarian universities, online since 2012. Astro static site plus
a small Cloudflare Worker; `json/**` is the data source of truth,
maintained by student pull requests (format documented in `readme.md`,
in Hungarian). Architecture and deploy runbook: `ARCHITECTURE.md`.

## Commands

- `npm test` – full suite; builds into `dist-test/` first.
  `SKIP_BUILD_TESTS=1` skips the build-dependent suites for quick runs.
- `npm run dev` / `npm run build` / `npm run preview` (wrangler dev)
- `node scripts/compare-live.mjs` – structural parity check against the
  live site (useful until the Laravel origin is retired).

## Hard invariants (tests enforce them; do not "fix")

- `json/**` stays exactly as it is: the files are the public contributor
  format and the localStorage course codes come from them verbatim.
- The localStorage contract is frozen: keys `coursesFinished` /
  `coursesProcessing` (JSON arrays of course codes) and `creditsOptional`
  (number). Progress stored by existing users must keep working.
- The DOM contract between the Astro components and
  `public/assets/js/targygraf.js`: `.course` carries `data-code`,
  `data-id` (6-char zero-padded), `data-credits`, `data-prerequisites`
  (`#` prefix = parallel, `___n___` = credit gate) and
  `data-referenced-course-blocks`; block ids are underscore-padded; a
  column's footprint stays at most 146px wide.
- Prerequisite token order: credit gates first, then page position. This
  mirrors the old MySQL id order and is visible in tooltips.
- Quirks deliberately preserved from the jQuery original: a click affects
  only the clicked cell; restoring marks every duplicate-code cell but
  counts only the first; the semester credit maximum sums the whole row.

Read the header comments of `src/lib/data.ts` and
`public/assets/js/targygraf.js` before changing either.

## Conventions

- Site copy is Hungarian; no em-dashes anywhere in copy.
- URLs are apex paths (`/pe/mernokinformatikus`); the Worker 301s the
  legacy per-university subdomains.
- Tabs for indentation (see `.editorconfig`); no runtime JS dependencies,
  `targygraf.js` stays dependency-free vanilla.
