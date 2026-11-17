import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function createHandlers(directory) {
    const publicRoot = resolve(fileURLToPath(directory));
    let resolvedPublicRoot;

    async function findHtml(filename) {
        try {
            resolvedPublicRoot ??= await realpath(publicRoot);
            const actualPath = await realpath(filename);
            const pathFromRoot = relative(resolvedPublicRoot, actualPath);
            if (pathFromRoot === '..' || pathFromRoot.startsWith('..' + sep) || isAbsolute(pathFromRoot)) return null;
            return (await stat(actualPath)).isFile() ? actualPath : null;
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
            throw error;
        }
    }

    async function sendHtml(filename, request, response, statusCode) {
        const html = await readFile(filename);
        response.statusCode = statusCode;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Content-Length', html.length);
        response.end(request.method === 'HEAD' ? undefined : html);
    }

    async function middleware(request, response, next) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();

        const requestUrl = request.url ?? '/';
        const queryIndex = requestUrl.indexOf('?');
        const rawPath = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
        const search = queryIndex === -1 ? '' : requestUrl.slice(queryIndex);
        let pathname;
        try {
            pathname = decodeURIComponent(rawPath);
        } catch {
            return next();
        }
        if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\0]/.test(pathname)) return next();
        if (pathname.split('/').some((part) => part === '.' || part === '..')) return next();

        let canonicalPath = rawPath.startsWith('/html/') ? rawPath.slice(5) : rawPath;
        if (canonicalPath === '/html' || canonicalPath === '/index' || canonicalPath === '/index.html') {
            canonicalPath = '/';
        } else if (canonicalPath.endsWith('/index.html')) {
            canonicalPath = canonicalPath.slice(0, -10);
        } else if (canonicalPath.endsWith('.html')) {
            canonicalPath = canonicalPath.slice(0, -5);
        }

        function redirect(location) {
            response.statusCode = 301;
            response.setHeader('Location', location + search);
            response.end();
        }

        if (canonicalPath.startsWith('//')) return next();
        if (canonicalPath !== rawPath) return redirect(canonicalPath);
        if (extname(pathname)) return next();

        try {
            const pathOnDisk = resolve(publicRoot, pathname.slice(1));
            let filename = pathname.endsWith('/') ? null : await findHtml(pathOnDisk + '.html');
            if (!filename) {
                filename = await findHtml(resolve(pathOnDisk, 'index.html'));
                if (filename && !pathname.endsWith('/')) return redirect(rawPath + '/');
            }
            if (!filename) return next();

            await sendHtml(filename, request, response, 200);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return next();
            next(error);
        }
    }

    async function notFound(request, response, next) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        try {
            const filename = await findHtml(resolve(publicRoot, '404.html'));
            if (!filename) return next();
            await sendHtml(filename, request, response, 404);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return next();
            next(error);
        }
    }

    return { middleware, notFound };
}

export function legacyUrls(
    publicDir = new URL('../public/', import.meta.url),
    previewDir = new URL('../dist/', import.meta.url),
) {
    return {
        name: 'legacy-urls',
        configureServer(server) {
            server.middlewares.use(createHandlers(publicDir).middleware);
        },
        configurePreviewServer(server) {
            const { middleware, notFound } = createHandlers(previewDir);
            server.middlewares.use(middleware);
            return () => server.middlewares.use(notFound);
        },
    };
}

export default legacyUrls;
