import { defineConfig } from 'astro/config';
import { legacyUrls } from './scripts/legacy-urls.mjs';

export default defineConfig({
    site: 'https://xdd44.xyz',
    output: 'static',
    build: { format: 'file' },
    trailingSlash: 'ignore',
    devToolbar: { enabled: false },
    vite: {
        plugins: [legacyUrls(new URL('./public/', import.meta.url), new URL('./dist/', import.meta.url))],
    },
});
