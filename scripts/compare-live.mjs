/**
 * Structural parity check: fetches the live (Laravel) targygraf.hu pages and
 * compares them against the local build in dist/.
 *
 * Padded ids differ by design (global DB autoincrement vs per-program
 * counters), so everything id-based is remapped to course codes / block
 * positions before comparing. What must match:
 *   - course sequence: code, name, credits, tooltip title
 *   - prerequisite structure (codes + parallel flags + credit gates)
 *   - referenced-course-block structure (by block position)
 *   - block titles, is_counted flags, <hr> separators, ∑ lines
 *   - program selector contents/order, home page university order
 *
 * Usage: node scripts/compare-live.mjs [uni_fac_program.json ...]
 *        (no args = all universities + all programs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(REPO_ROOT, 'dist');
const JSON_ROOT = path.join(REPO_ROOT, 'json');

let failures = 0;
let checkedPages = 0;

function report(page, message) {
	failures++;
	console.log(`MISMATCH ${page}: ${message}`);
}

function jsonSlugs(dir) {
	return fs
		.readdirSync(path.join(JSON_ROOT, dir))
		.filter((f) => f[0] !== '.' && f.endsWith('.json'))
		.map((f) => path.basename(f, '.json'))
		.sort();
}

async function fetchLive(url) {
	const response = await fetch(url, { headers: { 'User-Agent': 'targygraf-migration-check' } });
	if (!response.ok) {
		throw new Error(`${url}: HTTP ${response.status}`);
	}
	return parse(await response.text());
}

function readDist(...segments) {
	return parse(fs.readFileSync(path.join(DIST, ...segments), 'utf8'));
}

/** Extract the id-independent structure of a program page. */
function programStructure(root) {
	const idToCode = new Map();
	const blockIdToIndex = new Map();

	const blocks = root.querySelectorAll('.course-block');
	blocks.forEach((block, index) => {
		blockIdToIndex.set(block.getAttribute('data-id'), index);
	});
	for (const course of root.querySelectorAll('.course')) {
		idToCode.set(course.getAttribute('data-id'), course.getAttribute('data-code') ?? '');
	}

	const mapPrereqToken = (token) => {
		const parallel = token.startsWith('#');
		const id = parallel ? token.slice(1) : token;
		const code = /^___\d+___$/.test(id) ? id : idToCode.get(id) ?? `<unresolved:${id}>`;
		return (parallel ? '#' : '') + code;
	};

	return {
		h1: root.querySelector('h1')?.text.replace(/\s+/g, ' ').trim(),
		description: root.querySelector('.program-description')?.text.trim() ?? null,
		curriculum:
			root
				.querySelector('.program-curriculum-outdated, .program-curriculum-updated')
				?.text.replace(/\s+/g, ' ')
				.trim() ?? null,
		contents: root.querySelectorAll('.content').map((c) => c.getAttribute('data-specialis')),
		blocks: blocks.map((block) => ({
			title: block.querySelector('.course-block-title')?.innerHTML.trim(),
			isCounted: block.getAttribute('data-is-counted'),
			separators: block.querySelectorAll('hr').length,
			sumLine: block.querySelector(':scope > .muted')?.text.replace(/\s+/g, ' ').trim() ?? null,
			courses: block.querySelectorAll('.course').map((course) => ({
				code: course.getAttribute('data-code') ?? '',
				name: course.text.trim(),
				credits: course.getAttribute('data-credits'),
				title: course.getAttribute('title'),
				prerequisites: (course.getAttribute('data-prerequisites') || '')
					.split(',')
					.filter(Boolean)
					.map(mapPrereqToken),
				blockRefs: (course.getAttribute('data-referenced-course-blocks') || '')
					.split(',')
					.filter(Boolean)
					.map((id) => blockIdToIndex.get(id) ?? `<unresolved:${id}>`),
			})),
		})),
		selector: root
			.querySelectorAll('.program-selector .faculty')
			.map((faculty) => ({
				name: faculty.querySelector('.faculty-name')?.text.trim(),
				programs: faculty.querySelectorAll('a.program').map((a) => ({
					name: a.text.trim(),
					slug: new URL(a.getAttribute('href'), 'https://x.targygraf.hu').pathname
						.split('/')
						.filter(Boolean)
						.pop(),
					active: a.classList.contains('active'),
				})),
			})),
	};
}

function diffStructures(page, live, local) {
	const liveJson = JSON.stringify(live, null, 1);
	const localJson = JSON.stringify(local, null, 1);
	if (liveJson === localJson) {
		return;
	}
	const liveLines = liveJson.split('\n');
	const localLines = localJson.split('\n');
	for (let i = 0; i < Math.max(liveLines.length, localLines.length); i++) {
		if (liveLines[i] !== localLines[i]) {
			report(
				page,
				`first differing line ${i}:\n  live : ${liveLines[i]}\n  local: ${localLines[i]}`
			);
			break;
		}
	}
}

async function compareProgram(programFile) {
	const [uni, , prog] = programFile.split('_');
	const live = await fetchLive(`https://${uni}.targygraf.hu/${prog}`);
	const local = readDist(uni, `${prog}.html`);
	diffStructures(`${uni}/${prog}`, programStructure(live), programStructure(local));
	checkedPages++;
}

async function compareUniversity(uni) {
	const live = await fetchLive(`https://${uni}.targygraf.hu`);
	const local = readDist(`${uni}.html`);

	const pick = (root) => ({
		h1: root.querySelector('h1')?.text.trim(),
		hasLogo: Boolean(root.querySelector('img.university-logo')),
		selector: programStructure(root).selector,
	});
	diffStructures(uni, pick(live), pick(local));
	checkedPages++;
}

async function compareHome() {
	const live = await fetchLive('https://targygraf.hu');
	const local = readDist('index.html');

	const pick = (root, slugFrom) => ({
		universities: root.querySelectorAll('a.university').map((a) => ({
			slug: slugFrom(a.getAttribute('href')),
			name: a.querySelector('.name')?.text.trim(),
		})),
		breaks: root.querySelectorAll('main br').length,
	});
	diffStructures(
		'home',
		pick(live, (href) => new URL(href).hostname.split('.')[0]),
		pick(local, (href) => href.split('/').filter(Boolean).pop())
	);
	checkedPages++;
}

const args = process.argv.slice(2);
const programs = args.length
	? args.map((a) => a.replace(/\.json$/, ''))
	: jsonSlugs('programs');

// Home and university pages were intentionally redesigned after the 1:1
// migration was verified; only the program pages' graph structure remains
// comparable with the live Laravel output. Pass --chrome to re-enable the
// legacy home/university comparisons.
if (args.includes('--chrome')) {
	await compareHome();
	for (const uni of jsonSlugs('universities')) {
		await compareUniversity(uni);
	}
}
for (const program of programs.filter((p) => p !== '--chrome')) {
	await compareProgram(program);
}

console.log(`\nChecked ${checkedPages} pages: ${failures === 0 ? 'ALL MATCH' : `${failures} mismatch(es)`}`);
process.exit(failures === 0 ? 0 : 1);
