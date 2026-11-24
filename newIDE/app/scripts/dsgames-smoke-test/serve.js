// @ts-check
/**
 * DSGAMES fork: serve a built editor the way games.dosminutos.es does, for
 * the smoke test (smoke-test.js): the build under /editor/, with an SPA
 * fallback to its index.html, and the header that lets the editor register
 * its service worker for "Preview" with the /browser_sw_preview/ scope (see
 * src/ServiceWorkerSetup.js and the nginx configuration of the server).
 *
 * Usage: node serve.js <build folder> [port]
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const buildPath = path.resolve(process.argv[2] || '../../build');
const port = Number(process.argv[3] || 8769);
const prefix = '/editor/';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** @param {string} filePath */
const isFile = filePath => {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/editor') pathname = prefix;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end('Not found');
    return;
  }

  let filePath = path.join(buildPath, pathname.slice(prefix.length));
  if (filePath !== buildPath && !filePath.startsWith(buildPath + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (!isFile(filePath) && isFile(path.join(filePath, 'index.html'))) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!isFile(filePath)) {
    // SPA fallback, like `try_files $uri $uri/ /editor/index.html`.
    filePath = path.join(buildPath, 'index.html');
  }

  const headers = {
    'Content-Type':
      contentTypes[path.extname(filePath).toLowerCase()] ||
      'application/octet-stream',
    'Cache-Control': 'no-cache',
  };
  if (pathname === `${prefix}service-worker.js`) {
    headers['Service-Worker-Allowed'] = '/browser_sw_preview/';
  }
  response.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.info(`Serving ${buildPath} on http://127.0.0.1:${port}${prefix}`);
});
