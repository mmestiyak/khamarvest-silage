// Minimal static file server for local preview (no dependencies)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = 8321;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let file = path.normalize(path.join(root, urlPath));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, stats) => {
    // Mirror Cloudflare Workers Assets: extensionless URLs resolve to the .html file.
    if (err && !path.extname(file) && fs.existsSync(file + '.html')) { file += '.html'; err = null; stats = { isDirectory: () => false }; }
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (stats.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (rerr, data) => {
      if (rerr) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(port, () => console.log('Serving ' + root + ' at http://localhost:' + port));
