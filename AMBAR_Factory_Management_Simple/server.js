const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 10000;
const root = path.join(__dirname, 'public');
http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/health') { res.writeHead(200, {'content-type':'application/json'}); return res.end(JSON.stringify({ok:true, app:'AMBAR Factory Management'})); }
  let file = pathname === '/' ? path.join(root, 'index.html') : path.join(root, pathname.replace(/^\/+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, {'content-type':type, 'x-content-type-options':'nosniff'}); res.end(data);
  });
}).listen(port, () => console.log(`AMBAR Factory Management running on ${port}`));
