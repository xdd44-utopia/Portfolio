# Portfolio

Chenyue "xdd44" Dai's portfolio, built with Astro and exported as a static website.

## Local development

Use Node.js 22.23.4 or newer (Node 24 is supported).

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro. To check the production output:

```sh
npm run build
npm run preview
```

The build writes `dist/`. Navigation and footer are included in the HTML, so they no longer require browser requests or jQuery. Existing CSS and browser scripts retain their global behavior. Stylesheet and script URLs on Astro pages receive content-based versions automatically; `version.sh` now runs the build instead of editing HTML files.

`npm run preview` uses Vite to serve the build with the site's legacy redirects and custom 404 page. Astro's default preview does not load the compatibility plugin.

## Editing content

- `src/pages/`: page content and routes, keeping the existing names and casing.
- `src/layouts/`: shared site, project, blog, and photography layouts.
- `src/components/`: navigation, footer, metadata, and homepage project cards.
- `src/data/projects.ts`: homepage categories and ordered project cards, including video cards.
- `src/pages/Photography/`: ordered photo lists, headings, and gallery text.
- `public/`: original images, downloads, fonts, styles, and browser scripts. These keep their existing root URLs, such as `/image/Profile.jpg`.

For a new project, copy a neighboring `.astro` page in the appropriate category, change its metadata and body, then add its card to `src/data/projects.ts`. A page at `src/pages/Computing/Example.astro` is available at `/Computing/Example`.

APD and Bahrain keep their independent HTML, styles, and scripts under `public/APD/` and `public/BahrainVeniceBiennale/`. APD's Three.js venue remains `/APD/final`. Keep each directory's internal hierarchy intact. The standalone Feral presentation lives at `/Feral/Feral_Deck_260801`, with its assets beside it in `public/Feral/materials/`. Legacy `/html/Feral/` URLs redirect to `/Feral/`.

The three 11C85 assignments use Astro pages with their original article styling and the shared navigation/footer. A future chat or Three.js page can use its own layout and browser scripts; React is not installed until an interactive page needs it.

## Deployment

The existing server is `35.184.239.91`. Run `npm ci` and `npm run build` on the deployment checkout, or upload the contents of a locally built `dist/` directory. Nginx must serve the generated output, not the repository root:

```nginx
root /home/xdd44_utopia/Portfolio/dist;
```

`nginx_default.conf` retains the existing domain and TLS settings, redirects old `/html/` and `.html` links, serves extensionless pages, and returns the custom 404 page for missing routes. Apply it through the server's existing configuration process and validate it with `nginx -t` before reloading Nginx. Local development and preview apply the same legacy URL conventions through `scripts/legacy-urls.mjs`.

The build is static; no Node.js process is needed to serve it. Future backend APIs can be hosted separately.

## Notice

All photos and projects contained on this site are works of Chenyue "xdd44" DAI. All rights reserved.
