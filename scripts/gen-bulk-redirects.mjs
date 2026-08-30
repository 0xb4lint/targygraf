/**
 * Generates cloudflare-bulk-redirects.csv: the frozen inventory of legacy
 * {university}.targygraf.hu URLs mapped to their apex-path replacements.
 *
 * This is the zero-worker alternative to worker/index.ts: import the CSV as
 * a Cloudflare Bulk Redirect List (Dashboard -> Bulk Redirects), attach the
 * 12 subdomains as custom domains of the assets project, and the Worker
 * script can be dropped. The list never needs regenerating: new programs
 * only ever exist at apex paths, so the legacy URL space is frozen at
 * migration time.
 *
 * Usage: node scripts/gen-bulk-redirects.mjs > cloudflare-bulk-redirects.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_ROOT = path.join(REPO_ROOT, 'json');
const DOMAIN = 'targygraf.hu';

function slugs(directory) {
	return fs
		.readdirSync(path.join(JSON_ROOT, directory))
		.filter((file) => file[0] !== '.' && file.endsWith('.json'))
		.map((file) => path.basename(file, '.json'))
		.sort();
}

const lines = [
	// source_url,target_url,status,preserve_query_string,include_subdomains,subpath_matching,preserve_path_suffix
	`https://www.${DOMAIN}/,https://${DOMAIN}/,301,true,false,false,false`,
];

for (const university of slugs('universities')) {
	lines.push(
		`https://${university}.${DOMAIN}/,https://${DOMAIN}/${university},301,true,false,false,false`
	);
}

for (const program of slugs('programs')) {
	const [university, , slug] = program.split('_');
	lines.push(
		`https://${university}.${DOMAIN}/${slug},https://${DOMAIN}/${university}/${slug},301,true,false,false,false`
	);
}

process.stdout.write(lines.join('\n') + '\n');
