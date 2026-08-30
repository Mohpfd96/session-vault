import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env['PORT'] ?? 4173);
const host = process.env['HOST'] ?? '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function readStatic(relativePath) {
  const filePath = path.join(__dirname, relativePath);
  const extension = path.extname(filePath);
  const content = await readFile(filePath);
  const contentType = mimeTypes[extension as keyof typeof mimeTypes] ?? 'text/plain';
  return { content, contentType };
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);

    if (url.pathname === '/api/set-cookie') {
      const name = url.searchParams.get('name') ?? 'lab';
      const value = url.searchParams.get('value') ?? 'alice-secret';
      response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Set-Cookie': `${name}=${value}; Path=/; HttpOnly`,
      });
      response.end('ok');
      return;
    }

    if (url.pathname === '/redirect') {
      const target = url.searchParams.get('target') ?? '/';
      response.writeHead(302, {
        Location: target,
        'Set-Cookie': 'redirect=1; Path=/',
      });
      response.end();
      return;
    }

    if (url.pathname === '/landing') {
      const { content, contentType } = await readStatic('index.html');
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
      return;
    }

    const staticPath =
      url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//u, '');
    const { content, contentType } = await readStatic(staticPath);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});

server.listen(port, host, () => {
  console.log(`Session Vault test-site listening on http://${host}:${port}`);
});
