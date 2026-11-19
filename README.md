# Portfolio

Chenyue "xdd44" Dai's portfolio, built with Astro and exported as a static website.

## Local development

Requires Node.js 22.23.4 or newer.

```sh
npm ci
npm run dev
```

The standalone **The Human Option** chat page at `/thehumanoption` also needs a Python backend. See its [setup and development instructions](server/thehumanoption/README.md) for Python installation, keys, and running both servers.

Build and preview:

```sh
npm run build
npm run preview
```

## Editing content

- `src/pages/`: pages and routes.
- `src/layouts/` and `src/components/`: shared UI.
- `src/data/projects.ts`: homepage project cards.
- `public/`: assets and standalone APD, Bahrain, and Feral pages.

For a new project, copy a neighboring `.astro` page and add its card to `src/data/projects.ts`.

## Deployment

Pushes to `master` build and deploy `dist/` through GitHub Actions. The workflow also supports manual runs and verifies the live homepage after uploading.

Connection details use repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`.

## Notice

All photos and projects contained on this site are works of Chenyue "xdd44" DAI. All rights reserved.
