/**
 * Generates the Tárgygráf brand SVGs with text converted to outlines
 * (an SVG loaded via <img> cannot use webfonts, so the type must be paths):
 *
 *   public/assets/img/logo.svg        ink text    (light backgrounds)
 *   public/assets/img/logo-dark.svg   white text  (the ink program header)
 *
 * Font: IBM Plex Sans Condensed Bold (OFL). Download the TTF from
 * github.com/google/fonts next to this script, then run:
 *   npm i --no-save opentype.js && node scripts/generate-logo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.resolve(SCRIPT_DIR, '..', 'public', 'assets', 'img');

const load = (p) => {
	const b = fs.readFileSync(p);
	return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const cond = load(path.join(SCRIPT_DIR, 'PlexCondBold.ttf'));

const INK = '#17223B';
const GREEN = '#2BC875';
const WARM = '#E2571E';

const fmt = (n) => Math.round(n * 100) / 100;

/** Path data for a string with kerning + tracking; returns {d, width, bbox}. */
function textPath(font, text, x, y, size, tracking) {
	const scale = size / font.unitsPerEm;
	let cursor = x;
	let d = '';
	let prev = null;
	const boxes = [];
	for (const ch of text) {
		const glyph = font.charToGlyph(ch);
		if (prev) {
			cursor += font.getKerningValue(prev, glyph) * scale;
		}
		const p = glyph.getPath(cursor, y, size);
		d += p.toPathData(2);
		const b = p.getBoundingBox();
		if (b.x2 > b.x1) boxes.push(b);
		cursor += glyph.advanceWidth * scale + tracking;
		prev = glyph;
	}
	const width = cursor - tracking - x;
	const bbox = {
		x1: Math.min(...boxes.map((b) => b.x1)),
		y1: Math.min(...boxes.map((b) => b.y1)),
		x2: Math.max(...boxes.map((b) => b.x2)),
		y2: Math.max(...boxes.map((b) => b.y2)),
	};
	return { d, width, bbox };
}

/* ------------------------------------------------------------------ */
/* v12h lockup                                                         */
/* ------------------------------------------------------------------ */
function lockup(textColor, file) {
	const SIZE = 26;
	const TRACK = 1;
	const X = 8;
	const BASE = 31;

	const t = textPath(cond, 'TÁRGYGRÁF', X, BASE, SIZE, TRACK);
	const W = t.width;

	// The underline composition spans exactly the wordmark width:
	// rule + 4px gap + 8px cell, right-aligned with the text.
	const CELL_W = 8;
	const GAP = 4;
	const ruleW = W - GAP - CELL_W;
	const ruleY = 37;
	const cellX = X + W - CELL_W;

	const top = Math.floor(t.bbox.y1) - 1;
	const bottom = 42.5;
	const right = fmt(X + W + 2);

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 ${top} ${fmt(right - 6)} ${fmt(bottom - top)}" role="img" aria-label="Tárgygráf">
	<title>Tárgygráf</title>
	<path d="${t.d}" fill="${textColor}"/>
	<rect x="${X}" y="${ruleY}" width="${fmt(ruleW)}" height="3" fill="${WARM}"/>
	<rect x="${fmt(cellX)}" y="35.5" width="${CELL_W}" height="6" rx="1.5" fill="${GREEN}"/>
</svg>
`;
	fs.writeFileSync(path.join(IMG_DIR, file), svg);
	console.log(`${file}: text width ${fmt(W)}, viewBox 6 ${top} ${fmt(right - 6)} ${fmt(bottom - top)}`);
}

lockup(INK, 'logo.svg');
lockup('#FFFFFF', 'logo-dark.svg');
