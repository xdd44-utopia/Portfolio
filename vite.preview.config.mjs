import { defineConfig } from 'vite';
import { legacyUrls } from './scripts/legacy-urls.mjs';

export default defineConfig({
    appType: 'mpa',
    publicDir: false,
    build: { outDir: 'dist' },
    plugins: [legacyUrls(new URL('./public/', import.meta.url), new URL('./dist/', import.meta.url))],
});
