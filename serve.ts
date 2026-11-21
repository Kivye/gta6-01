import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json'
};

export function serve(root: string, port: number): void {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      let path = normalize(decodeURIComponent(url.pathname));
      if (path.endsWith('/')) path += 'index.html';
      const file = join(root, path);
      if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  server.listen(port, () => console.log('http://localhost:' + port));
}
