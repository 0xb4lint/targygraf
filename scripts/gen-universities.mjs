/**
 * Generates worker/universities.generated.json: the list of university
 * subdomains the Cloudflare Worker routes. Runs automatically before
 * build/test (see package.json scripts); the file is gitignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNIVERSITIES_DIR = path.join(REPO_ROOT, 'json', 'universities');
const OUT_FILE = path.join(REPO_ROOT, 'worker', 'universities.generated.json');

const slugs = fs
	.readdirSync(UNIVERSITIES_DIR)
	.filter((file) => file[0] !== '.' && file.endsWith('.json'))
	.map((file) => path.basename(file, '.json'))
	.sort();

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(slugs, null, '\t') + '\n');
console.log(`wrote ${OUT_FILE} (${slugs.length} universities)`);
