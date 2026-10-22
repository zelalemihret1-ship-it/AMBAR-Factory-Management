const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const sessions = new Map();
const publicDir = path.join(__dirname, "public");

function send(res, status, body, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type": type, "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"});
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch(e) { reject(e); } });
    req.on("error", reject);
  });
}
function authorized(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return !!token && sessions.has(token);
}
async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, {ok:true, databaseConfigured:!!supabase});
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    if (!ADMIN_PASSWORD) return send(res, 503, {error:"Set ADMIN_PASSWORD in Render Environment first."});
    const body = await readBody(req);
    const a = Buffer.from(String(body.password || ""));
    const b = Buffer.from(ADMIN_PASSWORD);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return send(res, 401, {error:"Incorrect password"});
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now());
    return send(res, 200, {token});
  }
  if (!url.pathname.startsWith("/api/")) return false;
  if (!authorized(req)) return send(res, 401, {error:"Please sign in again."});
  if (!supabase) return send(res, 503, {error:"Database is not connected yet. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render."});

  if (req.method === "GET" && url.pathname === "/api/items") {
    const {data,error} = await supabase.from("factory_items").select("*").order("created_at",{ascending:false});
    if(error) return send(res,500,{error:error.message});
    return send(res,200,{items:data});
  }
  if (req.method === "POST" && url.pathname === "/api/items") {
    const body = await readBody(req);
    const item = {
      name: String(body.name || "").trim().slice(0,120),
      stage: String(body.stage || "Material preparation"),
      quantity: Math.max(0, Number(body.quantity)||0),
      notes: String(body.notes || "").trim().slice(0,500)
    };
    const allowed = ["Material preparation","Cutting","Assembly","Finishing","Completed","Sold"];
    if (!item.name) return send(res,400,{error:"Enter a product or job name."});
    if (!allowed.includes(item.stage)) return send(res,400,{error:"Choose a valid production stage."});
    const {data,error} = await supabase.from("factory_items").insert(item).select().single();
    if(error) return send(res,500,{error:error.message});
    return send(res,201,{item:data});
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/items/")) {
    const id = url.pathname.split("/").pop();
    const body = await readBody(req);
    const updates = {};
    if (body.stage) updates.stage = String(body.stage);
    if (body.quantity !== undefined) updates.quantity = Math.max(0, Number(body.quantity)||0);
    if (body.notes !== undefined) updates.notes = String(body.notes).slice(0,500);
    const {data,error} = await supabase.from("factory_items").update(updates).eq("id",id).select().single();
    if(error) return send(res,500,{error:error.message});
    return send(res,200,{item:data});
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/items/")) {
    const id = url.pathname.split("/").pop();
    const {error} = await supabase.from("factory_items").delete().eq("id",id);
    if(error) return send(res,500,{error:error.message});
    return send(res,200,{ok:true});
  }
  return send(res,404,{error:"Not found"});
}
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req,res,url);
      if (handled !== false) return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const file = path.normalize(path.join(publicDir, pathname));
    if (!file.startsWith(publicDir)) return send(res,403,"Forbidden","text/plain");
    fs.readFile(file,(err,buf)=>{
      if(err) return send(res,404,"Not found","text/plain");
      const ext=path.extname(file);
      const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};
      send(res,200,buf,types[ext]||"application/octet-stream");
    });
  } catch(e) { send(res,500,{error:"Server error"}); }
});
server.listen(PORT, "0.0.0.0", () => console.log(`AMBAR Factory app listening on ${PORT}`));