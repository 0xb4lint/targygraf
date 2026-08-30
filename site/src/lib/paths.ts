import path from 'node:path';
import { fileURLToPath } from 'node:url';

// site/src/lib/paths.ts -> repo root is three levels up
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const JSON_ROOT = path.join(REPO_ROOT, 'json');
