require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cron = require("node-cron");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const required = ["DATABASE_URL", "JWT_SECRET", "ADMIN_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) console.warn(`WARNING: ${key} is not configured.`);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "development-only-change-me";

async function query(sql, params = []) {
  return pool.query(sql, params);
}
async function initDb() {
  const schema = require("fs").readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await query(schema);
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const name = process.env.ADMIN_NAME || "Factory Admin";
  const password = process.env.ADMIN_PASSWORD;
  if (password) {
    const found = await query("SELECT id FROM users WHERE username=$1", [username]);
    if (!found.rowCount) {
      const hash = await bcrypt.hash(password, 12);
      await query("INSERT INTO users(name,username,password_hash,role) VALUES($1,$2,$3,'admin')", [name, username, hash]);
      console.log(`Initial admin created: ${username}`);
    }
  }
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) throw new Error("Missing token");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in again." });
  }
}
function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Your account does not have permission for this action." });
}
async function logAction(userId, action, details = "") {
  await query("INSERT INTO activity_log(user_id,action,details) VALUES($1,$2,$3)", [userId || null, action, details]);
}
function today() { return new Date().toISOString().slice(0, 10); }
function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
async function dashboardData() {
  const [workflow, finished, stock, sold, materials, low, recent] = await Promise.all([
    query("SELECT COALESCE(SUM(quantity),0)::int n FROM workflow_entries WHERE stage <> 'Completed'"),
    query("SELECT COALESCE(SUM(quantity),0)::int n FROM stock_movements WHERE movement_type='produced' AND movement_date=CURRENT_DATE"),
    query("SELECT COALESCE(SUM(CASE WHEN movement_type='produced' THEN quantity WHEN movement_type='sold' THEN -quantity ELSE quantity END),0)::int n FROM stock_movements"),
    query("SELECT COALESCE(SUM(quantity),0)::int n FROM stock_movements WHERE movement_type='sold' AND movement_date=CURRENT_DATE"),
    query("SELECT COUNT(DISTINCT material_name)::int n FROM material_movements"),
    query(`WITH balances AS (
       SELECT material_name, unit,
       SUM(CASE WHEN movement_type='received' THEN quantity WHEN movement_type IN ('used','waste') THEN -quantity ELSE quantity END) balance
       FROM material_movements GROUP BY material_name,unit)
       SELECT COUNT(*)::int n FROM balances WHERE balance <= 5`),
    query(`SELECT a.id,a.action,a.details,a.created_at,u.name employee
      FROM activity_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`)
  ]);
  return {
    inProduction: workflow.rows[0].n,
    finishedToday: finished.rows[0].n,
    soldToday: sold.rows[0].n,
    stockUnits: stock.rows[0].n,
    materialTypes: materials.rows[0].n,
    lowMaterials: low.rows[0].n,
    recent: recent.rows
  };
}

app.get("/api/health", (req,res) => res.json({ ok:true, service:"AMBAR Furniture Factory Management" }));
app.post("/api/login", asyncRoute(async (req,res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const result = await query("SELECT id,name,username,password_hash,role,active FROM users WHERE username=$1", [username]);
  const user = result.rows[0];
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({error:"Incorrect username or password."});
  const token = jwt.sign({id:user.id,name:user.name,username:user.username,role:user.role}, JWT_SECRET, {expiresIn:"12h"});
  await logAction(user.id,"Signed in","Dashboard login");
  res.json({token,user:{id:user.id,name:user.name,username:user.username,role:user.role}});
}));
app.get("/api/me", auth, (req,res) => res.json({user:req.user}));
app.get("/api/dashboard", auth, asyncRoute(async(req,res)=>res.json(await dashboardData())));

app.get("/api/products", auth, asyncRoute(async(req,res)=>{
  const result = await query(`SELECT p.*,
    COALESCE((SELECT SUM(CASE WHEN movement_type='produced' THEN quantity WHEN movement_type='sold' THEN -quantity ELSE quantity END) FROM stock_movements s WHERE s.product_id=p.id),0)::int stock,
    COALESCE((SELECT SUM(quantity) FROM stock_movements s WHERE s.product_id=p.id AND movement_type='produced'),0)::int produced,
    COALESCE((SELECT SUM(quantity) FROM stock_movements s WHERE s.product_id=p.id AND movement_type='sold'),0)::int sold
    FROM products p ORDER BY p.id DESC`);
  res.json(result.rows);
}));
app.post("/api/products", auth, allow("admin","manager","production"), asyncRoute(async(req,res)=>{
  const name=String(req.body.name||"").trim();
  if(!name) return res.status(400).json({error:"Product name is required."});
  const category=String(req.body.category||"").trim(), unit=String(req.body.unit||"piece").trim(), notes=String(req.body.notes||"").trim();
  const crypto = require("crypto");
  const inserted=await query("INSERT INTO products(product_code,name,category,unit,notes) VALUES($1,$2,$3,$4,$5) RETURNING id", [`NEW-${crypto.randomUUID()}`,name,category,unit,notes]);
  const id=inserted.rows[0].id, code=`AMB-${String(id).padStart(4,"0")}`;
  const result=await query("UPDATE products SET product_code=$1 WHERE id=$2 RETURNING *",[code,id]);
  await logAction(req.user.id,"Created product",`${code} · ${name}`);
  res.status(201).json(result.rows[0]);
}));
app.post("/api/workflow", auth, allow("admin","manager","production"), asyncRoute(async(req,res)=>{
  const productId=Number(req.body.product_id), quantity=Number(req.body.quantity), stage=String(req.body.stage||"");
  const allowed=["Preparation","Material preparation","Cutting","Assembly","Finishing","Completed"];
  if(!productId || !Number.isInteger(quantity) || quantity<=0 || !allowed.includes(stage)) return res.status(400).json({error:"Choose a product, valid stage and positive whole-number quantity."});
  const started=String(req.body.started_on||today()), notes=String(req.body.notes||"").trim();
  const product=await query("SELECT id,product_code,name FROM products WHERE id=$1",[productId]);
  if(!product.rowCount) return res.status(400).json({error:"Product not found."});
  const result=await query(`INSERT INTO workflow_entries(product_id,stage,quantity,started_on,completed_on,employee_id,notes)
    VALUES($1,$2,$3,$4,CASE WHEN $2='Completed' THEN CURRENT_DATE ELSE NULL END,$5,$6) RETURNING *`,
    [productId,stage,quantity,started,req.user.id,notes]);
  if(stage==="Completed") await query("INSERT INTO stock_movements(product_id,movement_type,quantity,employee_id,notes) VALUES($1,'produced',$2,$3,$4)",[productId,quantity,req.user.id,`From workflow completion: ${notes}`]);
  await logAction(req.user.id,"Workflow update",`${product.rows[0].product_code} · ${stage} · ${quantity}`);
  res.status(201).json(result.rows[0]);
}));
app.get("/api/workflow", auth, asyncRoute(async(req,res)=>{
  const result=await query(`SELECT w.*,p.product_code,p.name product_name,u.name employee FROM workflow_entries w JOIN products p ON p.id=w.product_id LEFT JOIN users u ON u.id=w.employee_id ORDER BY w.created_at DESC LIMIT 100`);
  res.json(result.rows);
}));
app.get("/api/materials", auth, asyncRoute(async(req,res)=>{
  const result=await query(`SELECT material_name,unit,
    SUM(CASE WHEN movement_type='received' THEN quantity WHEN movement_type IN ('used','waste') THEN -quantity ELSE quantity END)::numeric(12,3) balance,
    SUM(CASE WHEN movement_type='received' THEN quantity ELSE 0 END)::numeric(12,3) received,
    SUM(CASE WHEN movement_type='used' THEN quantity ELSE 0 END)::numeric(12,3) used,
    MAX(movement_date) last_movement
    FROM material_movements GROUP BY material_name,unit ORDER BY material_name`);
  res.json(result.rows);
}));
app.post("/api/materials", auth, allow("admin","manager","storekeeper"), asyncRoute(async(req,res)=>{
  const material=String(req.body.material_name||"").trim(), type=String(req.body.movement_type||""), unit=String(req.body.unit||"piece").trim(), quantity=Number(req.body.quantity);
  if(!material || !["received","used","waste","adjustment"].includes(type) || !Number.isFinite(quantity) || quantity<=0) return res.status(400).json({error:"Enter material, movement type and positive quantity."});
  const productId=req.body.product_id ? Number(req.body.product_id) : null;
  const supplier=String(req.body.supplier||"").trim(), notes=String(req.body.notes||"").trim();
  if(type==="used" || type==="waste") {
    const bal=await query("SELECT COALESCE(SUM(CASE WHEN movement_type='received' THEN quantity WHEN movement_type IN ('used','waste') THEN -quantity ELSE quantity END),0) balance FROM material_movements WHERE material_name=$1 AND unit=$2",[material,unit]);
    if(Number(bal.rows[0].balance)<quantity) return res.status(400).json({error:`Not enough recorded ${material} stock. Available: ${bal.rows[0].balance} ${unit}.`});
  }
  const result=await query(`INSERT INTO material_movements(material_name,movement_type,quantity,unit,supplier,product_id,employee_id,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[material,type,quantity,unit,supplier,productId,req.user.id,notes]);
  await logAction(req.user.id,"Material movement",`${material} · ${type} · ${quantity} ${unit}`);
  res.status(201).json(result.rows[0]);
}));
app.get("/api/stock-movements", auth, asyncRoute(async(req,res)=>{
  const result=await query(`SELECT s.*,p.product_code,p.name product_name,u.name employee FROM stock_movements s JOIN products p ON p.id=s.product_id LEFT JOIN users u ON u.id=s.employee_id ORDER BY s.created_at DESC LIMIT 100`);
  res.json(result.rows);
}));
app.post("/api/stock-movements", auth, allow("admin","manager","storekeeper","sales"), asyncRoute(async(req,res)=>{
  const productId=Number(req.body.product_id), type=String(req.body.movement_type||""), quantity=Number(req.body.quantity);
  if(!productId || !["produced","sold","adjustment"].includes(type) || !Number.isInteger(quantity) || quantity<=0) return res.status(400).json({error:"Choose a product, movement type and positive whole-number quantity."});
  if(type==="sold") {
    const stock=await query("SELECT COALESCE(SUM(CASE WHEN movement_type='produced' THEN quantity WHEN movement_type='sold' THEN -quantity ELSE quantity END),0)::int n FROM stock_movements WHERE product_id=$1",[productId]);
    if(stock.rows[0].n<quantity) return res.status(400).json({error:`Not enough stock. Available: ${stock.rows[0].n}.`});
  }
  const notes=String(req.body.notes||"").trim();
  const result=await query("INSERT INTO stock_movements(product_id,movement_type,quantity,employee_id,notes) VALUES($1,$2,$3,$4,$5) RETURNING *",[productId,type,quantity,req.user.id,notes]);
  const product=await query("SELECT product_code,name FROM products WHERE id=$1",[productId]);
  await logAction(req.user.id,"Stock movement",`${product.rows[0].product_code} · ${type} · ${quantity}`);
  res.status(201).json(result.rows[0]);
}));
app.get("/api/users", auth, allow("admin","manager"), asyncRoute(async(req,res)=>{
  const result=await query("SELECT id,name,username,role,active,created_at FROM users ORDER BY id");
  res.json(result.rows);
}));
app.post("/api/users", auth, allow("admin"), asyncRoute(async(req,res)=>{
  const name=String(req.body.name||"").trim(), username=String(req.body.username||"").trim().toLowerCase(), password=String(req.body.password||""), role=String(req.body.role||"");
  if(!name || !/^[a-z0-9_.-]{3,32}$/.test(username) || password.length<10 || !["manager","production","storekeeper","sales"].includes(role))
    return res.status(400).json({error:"Enter a name, username (3–32 letters/numbers), password (at least 10 characters), and valid non-admin role."});
  const hash=await bcrypt.hash(password,12);
  try {
    const result=await query("INSERT INTO users(name,username,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,username,role,active",[name,username,hash,role]);
    await logAction(req.user.id,"Created employee",`${username} · ${role}`);
    res.status(201).json(result.rows[0]);
  } catch(e) { if(e.code==="23505") return res.status(409).json({error:"That username is already taken."}); throw e; }
}));
app.patch("/api/users/:id", auth, allow("admin"), asyncRoute(async(req,res)=>{
  const id=Number(req.params.id), active=Boolean(req.body.active);
  if(id===req.user.id && !active) return res.status(400).json({error:"You cannot deactivate your own account."});
  const result=await query("UPDATE users SET active=$1 WHERE id=$2 AND role <> 'admin' RETURNING id,name,username,role,active",[active,id]);
  if(!result.rowCount) return res.status(404).json({error:"Employee not found or cannot be changed."});
  await logAction(req.user.id,"Updated employee",`${result.rows[0].username} active=${active}`);
  res.json(result.rows[0]);
}));
app.get("/api/reports/daily", auth, asyncRoute(async(req,res)=>{
  const date=String(req.query.date||today());
  const [workflow,stock,materials,activity]=await Promise.all([
    query(`SELECT stage,COUNT(*)::int entries,COALESCE(SUM(quantity),0)::int quantity FROM workflow_entries WHERE started_on=$1 GROUP BY stage ORDER BY stage`,[date]),
    query(`SELECT movement_type,COUNT(*)::int entries,COALESCE(SUM(quantity),0)::int quantity FROM stock_movements WHERE movement_date=$1 GROUP BY movement_type`,[date]),
    query(`SELECT material_name,unit,movement_type,SUM(quantity)::numeric(12,3) quantity FROM material_movements WHERE movement_date=$1 GROUP BY material_name,unit,movement_type ORDER BY material_name`,[date]),
    query(`SELECT a.action,a.details,a.created_at,u.name employee FROM activity_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.created_at::date=$1 ORDER BY a.created_at DESC`,[date])
  ]);
  res.json({date,workflow:workflow.rows,stock:stock.rows,materials:materials.rows,activity:activity.rows});
}));

app.get("/api/reports/export.csv", auth, asyncRoute(async(req,res)=>{
  const kind=String(req.query.kind||"stock");
  let result, headers, rows;
  if(kind==="products") {
    result=await query(`SELECT p.product_code,p.name,p.category,p.unit,
      COALESCE(SUM(CASE WHEN s.movement_type='produced' THEN s.quantity WHEN s.movement_type='sold' THEN -s.quantity ELSE s.quantity END),0)::int stock
      FROM products p LEFT JOIN stock_movements s ON s.product_id=p.id GROUP BY p.id ORDER BY p.id`);
    headers=["product_code","name","category","unit","stock"]; rows=result.rows;
  } else if(kind==="materials") {
    result=await query(`SELECT material_name,unit,
      SUM(CASE WHEN movement_type='received' THEN quantity WHEN movement_type IN ('used','waste') THEN -quantity ELSE quantity END)::numeric(12,3) balance
      FROM material_movements GROUP BY material_name,unit ORDER BY material_name`);
    headers=["material_name","unit","balance"]; rows=result.rows;
  } else {
    result=await query(`SELECT p.product_code,p.name,s.movement_type,s.quantity,s.movement_date,s.notes FROM stock_movements s JOIN products p ON p.id=s.product_id ORDER BY s.created_at DESC`);
    headers=["product_code","name","movement_type","quantity","movement_date","notes"]; rows=result.rows;
  }
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=[headers.map(esc).join(","),...rows.map(r=>headers.map(h=>esc(r[h])).join(","))].join("\r\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",`attachment; filename="ambar-${kind}-${today()}.csv"`);
  res.send("\uFEFF"+csv);
}));

app.use((err,req,res,next)=>{
  console.error(err);
  if(res.headersSent) return next(err);
  res.status(500).json({error:"Something went wrong. Check server logs and database configuration."});
});

async function telegramSend(text) {
  const token=process.env.TELEGRAM_BOT_TOKEN, chat=process.env.TELEGRAM_ADMIN_CHAT_ID;
  if(!token || !chat) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram sendMessage failed");
}
async function makeDailyText() {
  const d=await dashboardData();
  const date=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Addis_Ababa",dateStyle:"medium"}).format(new Date());
  return `🪑 AMBAR FURNITURE — DAILY REPORT\n📅 ${date}\n\n🏭 In production: ${d.inProduction}\n✅ Finished today: ${d.finishedToday}\n📦 Units sold today: ${d.soldToday}\n🗃 Current recorded stock: ${d.stockUnits}\n🪵 Material types tracked: ${d.materialTypes}\n⚠️ Low materials (balance ≤ 5): ${d.lowMaterials}\n\nFigures reflect entries recorded in the system.`;
}
async function setupTelegram() {
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) { console.log("Telegram scheduled reports skipped: TELEGRAM_BOT_TOKEN not configured."); return; }
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Telegram bot token could not be verified.");
  console.log(`Telegram bot verified: @${result.result.username}. Scheduled reports are enabled if TELEGRAM_ADMIN_CHAT_ID is set.`);
}
const reportCron=process.env.DAILY_REPORT_CRON || "0 18 * * *";
if(cron.validate(reportCron)) {
  cron.schedule(reportCron, async()=>{ try { await telegramSend(await makeDailyText()); console.log("Scheduled report sent (if Telegram credentials are configured)."); } catch(e) { console.error("Scheduled Telegram report failed:",e.message); } }, {timezone:"Africa/Addis_Ababa"});
} else console.warn("Invalid DAILY_REPORT_CRON; daily Telegram reports disabled.");

initDb().then(async()=>{
  await setupTelegram();
  app.listen(PORT,()=>console.log(`AMBAR Factory Management running on port ${PORT}`));
}).catch(err=>{ console.error("Startup failed. Check DATABASE_URL and PostgreSQL availability.",err); process.exit(1); });
