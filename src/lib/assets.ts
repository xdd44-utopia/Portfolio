import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const versions = new Map<string, string>();

export function assetUrl(path: string): string {
    if (!versions.has(path)) {
        const content = readFileSync(`public${path}`);
        versions.set(path, createHash('sha256').update(content).digest('hex').slice(0, 12));
    }
    return `${path}?v=${versions.get(path)}`;
}
