const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, 'public');
const storeDir = path.join(__dirname, 'data');
const dataFile = path.join(storeDir, 'factory-data.json');
const usersFile = path.join(storeDir, 'admin-users.json');
const configFile = path.join(storeDir, 'system-config.json');
fs.mkdirSync(storeDir, {recursive:true});
const sessions = new Map();
const DEFAULT_CONFIG = {appName:'AMBAR Factory Management', categories:['Shoe Shelf','Others','Gadgets'], materialCategories:['Normal MDF','Oak','Laminate','Plywood / Suf','Chipped','Australia','Morale','UV Black','Other'], workflowStages:['PREPARING','IN PRODUCTION','FINISHING','IN STOCK','DELIVERED','ON HOLD'], dateCalendar:'Ethiopian'};
const emptyData = () => ({jobs:[],stock:[],materials:[],cuts:[],marketing:[],savedReports:[]});
function readJson(file, fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file, value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file)}
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){const hash=crypto.scryptSync(password,salt,64).toString('hex');return {salt,hash}}
function verifyPassword(password, record){try{const actual=crypto.scryptSync(password,record.salt,64);return crypto.timingSafeEqual(actual,Buffer.from(record.hash,'hex'))}catch{return false}}
function users(){return readJson(usersFile,[])}
function initializeOwner(){const username=process.env.ADMIN_USERNAME;const password=process.env.ADMIN_PASSWORD;if(!username||!password){console.warn('ADMIN_USERNAME and ADMIN_PASSWORD must be set in hosting environment to enable first owner login.');return}if(password.length<12)console.warn('ADMIN_PASSWORD should be at least 12 characters.');const list=users();if(!list.some(u=>u.role==='owner')){const h=hashPassword(password);list.push({username:String(username).trim(),role:'owner',...h,createdAt:new Date().toISOString()});writeJson(usersFile,list)}}
initializeOwner();
if(!fs.existsSync(dataFile))writeJson(dataFile,emptyData());
if(!fs.existsSync(configFile))writeJson(configFile,DEFAULT_CONFIG);
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(JSON.stringify(obj))}
function cookie(req,name){const c=req.headers.cookie||'';const part=c.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return part?decodeURIComponent(part.slice(name.length+1)):''}
function auth(req){const token=cookie(req,'ambar_admin_session');const session=sessions.get(token);if(!session||session.expires<Date.now()){if(token)sessions.delete(token);return null}return session}
function requireAuth(req,res,owner=false){const user=auth(req);if(!user){send(res,401,{error:'Please sign in as an administrator.'});return null}if(owner&&user.role!=='owner'){send(res,403,{error:'Only the main administrator can do this.'});return null}if(req.method==='PUT'&&user.role==='viewer'){send(res,403,{error:'Your account is read-only.'});return null}return user}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>12*1024*1024){reject(new Error('Request is too large'));req.destroy()}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error('Invalid JSON body'))}});req.on('error',reject)})}
function validData(data){if(!data||typeof data!=='object'||Array.isArray(data))return false;return ['jobs','stock','materials','cuts'].every(k=>Array.isArray(data[k]))}
function safeUser(u){return {username:u.username,role:u.role,createdAt:u.createdAt}}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    try{
      if(req.method==='POST'&&url.pathname==='/api/login'){
        const b=await body(req);const list=users();const u=list.find(x=>x.username===String(b.username||'').trim());if(!u||!verifyPassword(String(b.password||''),u)){send(res,401,{error:'Incorrect username or password.'});return}
        const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{username:u.username,role:u.role,expires:Date.now()+8*60*60*1000});res.setHeader('Set-Cookie',`ambar_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?' ; Secure':''}`);send(res,200,{user:safeUser(u)});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/logout'){const token=cookie(req,'ambar_admin_session');sessions.delete(token);res.setHeader('Set-Cookie','ambar_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');send(res,200,{ok:true});return}
      if(req.method==='GET'&&url.pathname==='/api/me'){const u=auth(req);if(!u){send(res,401,{error:'Not signed in'});return}send(res,200,{user:{username:u.username,role:u.role}});return}
      if(req.method==='GET'&&url.pathname==='/api/data'){const u=requireAuth(req,res);if(!u)return;const d=readJson(dataFile,emptyData());send(res,200,{data:{jobs:d.jobs||[],stock:d.stock||[],materials:d.materials||[],cuts:d.cuts||[],marketing:d.marketing||[]},savedReports:d.savedReports||[],updatedAt:d.updatedAt||null});return}
      if(req.method==='PUT'&&url.pathname==='/api/data'){const u=requireAuth(req,res);if(!u)return;const b=await body(req);if(!validData(b.data)){send(res,400,{error:'Data must contain jobs, stock, materials, and cuts arrays.'});return}const old=readJson(dataFile,emptyData());const backup=path.join(storeDir,'factory-data-backup-'+Date.now()+'.json');writeJson(backup,old);writeJson(dataFile,{...old,...b.data,savedReports:Array.isArray(b.savedReports)?b.savedReports:(old.savedReports||[]),updatedAt:new Date().toISOString(),updatedBy:u.username});send(res,200,{ok:true,backup:path.basename(backup)});return}
      if(req.method==='POST'&&url.pathname==='/api/migrate'){const u=requireAuth(req,res,true);if(!u)return;const b=await body(req);if(!validData(b.data)){send(res,400,{error:'Browser data format is invalid.'});return}const old=readJson(dataFile,emptyData());const currentCount=['jobs','stock','materials','cuts','marketing'].reduce((n,k)=>n+(old[k]||[]).length,0);if(currentCount>0){send(res,409,{error:'Server already contains records. Nothing was overwritten. Download/compare backups and use the records editor to merge deliberately.'});return}const reports=Array.isArray(b.savedReports)?b.savedReports:[];writeJson(dataFile,{...b.data,savedReports:reports,updatedAt:new Date().toISOString(),migratedBy:u.username});send(res,200,{ok:true,message:`Copied ${b.data.jobs.length} workflow, ${b.data.stock.length} stock, ${b.data.materials.length} material receipts, ${b.data.cuts.length} cutting records and ${reports.length} saved reports. Browser copy was not deleted.`});return}
      if(req.method==='GET'&&url.pathname==='/api/config'){const u=requireAuth(req,res);if(!u)return;send(res,200,{config:readJson(configFile,DEFAULT_CONFIG)});return}
      if(req.method==='PUT'&&url.pathname==='/api/config'){const u=requireAuth(req,res,true);if(!u)return;const b=await body(req);if(!b.config||typeof b.config!=='object'||Array.isArray(b.config)){send(res,400,{error:'Configuration must be a JSON object.'});return}writeJson(configFile,b.config);send(res,200,{ok:true});return}
      if(req.method==='GET'&&url.pathname==='/api/users'){const u=requireAuth(req,res,true);if(!u)return;send(res,200,{users:users().map(safeUser)});return}
      if(req.method==='POST'&&url.pathname==='/api/users'){const u=requireAuth(req,res,true);if(!u)return;const b=await body(req);const username=String(b.username||'').trim();const password=String(b.password||'');const role=b.role==='viewer'?'viewer':'admin';if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)){send(res,400,{error:'Username must be 3–32 letters, numbers, dots, underscores or hyphens.'});return}if(password.length<12){send(res,400,{error:'Use a password with at least 12 characters.'});return}const list=users();if(list.some(x=>x.username.toLowerCase()===username.toLowerCase())){send(res,409,{error:'That username already exists.'});return}list.push({username,role,...hashPassword(password),createdAt:new Date().toISOString()});writeJson(usersFile,list);send(res,201,{ok:true});return}
      const remove=url.pathname.match(/^\/api\/users\/([^/]+)$/);if(req.method==='DELETE'&&remove){const u=requireAuth(req,res,true);if(!u)return;const name=decodeURIComponent(remove[1]);if(name===u.username){send(res,400,{error:'You cannot remove your own owner account.'});return}const list=users();const next=list.filter(x=>x.username!==name&&x.role!=='owner');if(next.length===list.length){send(res,404,{error:'Administrator not found.'});return}writeJson(usersFile,next);send(res,200,{ok:true});return}
      send(res,404,{error:'API route not found'});return;
    }catch(e){send(res,400,{error:e.message||'Request failed'});return}
  }
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end('Bad request');return}if(pathname==='/')pathname='/index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404);res.end('Not found');return}const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});res.end(buf)});
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('AMBAR Factory Management listening on '+(process.env.PORT||3000)));
