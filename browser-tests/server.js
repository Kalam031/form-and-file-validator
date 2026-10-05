'use strict';
// A tiny static file server for the browser tests (http://localhost, a secure context: crypto.subtle and DataTransfer work).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

function start() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            if (req.method === 'POST' || req.method === 'PUT') {   // upload endpoint for the browser tests: counts the bytes it receives, slowly, so progress events are visible
                let size = 0;
                req.on('data', c => { size += c.length; });
                req.on('end', () => { setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ size, method: req.method })); }, 30); });
                return;
            }
            const url = decodeURIComponent(req.url.split('?')[0]);
            const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
            if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
            fs.readFile(file, (err, data) => {
                if (err) { res.writeHead(404); return res.end('not found'); }
                res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        });
        server.listen(0, '127.0.0.1', () => resolve({ server, url: 'http://localhost:' + server.address().port, close: () => new Promise(r => server.close(r)) }));
    });
}

module.exports = { start };
