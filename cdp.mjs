import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const CHROME = process.env.CHROME || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.json': 'application/json', '.png': 'image/png' };

export function serveDir(root, port) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      try {
        let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (p.endsWith('/')) p += 'index.html';
        const file = join(root, p);
        if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch { res.writeHead(404); res.end('nf'); }
    });
    srv.listen(port, () => resolve(srv));
  });
}

export async function launchPage(width, height) {
  const proc = spawn(CHROME, ['--headless', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--window-size=' + width + ',' + height, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    setTimeout(() => reject(new Error('chromium start timeout')), 20000);
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => { ws.onopen = r; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  function send(method, params, sessionId) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
    });
  }
  const t = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = t.result.targetId;
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  const sid = att.result.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  const page = {
    proc, ws,
    async goto(url) { await send('Page.navigate', { url }, sid); },
    async ev(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
      if (r.result && r.result.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result && r.result.result ? r.result.result.value : undefined;
    },
    async key(code, down) {
      const key = code.replace('Key', '').replace('Digit', '');
      await send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key }, sid);
    },
    async shot(quality) {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality }, sid);
      return Buffer.from(r.result.data, 'base64');
    },
    async close() { try { ws.close(); } catch {} proc.kill('SIGKILL'); }
  };
  return page;
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
