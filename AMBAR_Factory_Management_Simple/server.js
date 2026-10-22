const http = require("http"); const fs = require("fs"); const path = require("path");
const PORT = process.env.PORT || 3000; const INDEX_FILE = path.join(__dirname, "public", "index.html");
const server = http.createServer((req, res) => { if (req.url === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "ok" })); return; }
if (req.url === "/" || req.url.startsWith("/?")) { fs.readFile(INDEX_FILE, (error, content) => { if (error) { res.writeHead(500, { "Content-Type": "text/plain" }); res.end("Interface file not found. Check public/index.html."); return; }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });
  res.end(content);
});
return;
}
res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); });
server.listen(PORT, "0.0.0.0", () => { console.log("AMBAR Factory Management running on port " + PORT); });
