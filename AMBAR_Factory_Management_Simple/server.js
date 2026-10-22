const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname,'data');
const STATE_FILE = path.join(DATA_DIR,'factory-state.json');
fs.mkdirSync(DATA_DIR,{recursive:true});
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname,'public')));
const seed = {orders:[],products:[],materials:[],sales:[],activityLog:[],nextId:10};
function readState(){
  try { return {...seed,...JSON.parse(fs.readFileSync(STATE_FILE,'utf8'))}; }
  catch { return null; }
}
function writeState(data){
  const clean={};
  for(const k of Object.keys(seed)) clean[k]=data[k]===undefined?seed[k]:data[k];
  const tmp=STATE_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(clean,null,2));
  fs.renameSync(tmp,STATE_FILE);
}
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'AMBAR shared workshop app'}));
app.get('/api/state',(_req,res)=>{
  let state=readState();
  if(!state){ state={...seed}; return res.json(state); }
  res.json(state);
});
app.put('/api/state',(req,res)=>{
  if(!req.body || typeof req.body!=='object' || Array.isArray(req.body)) return res.status(400).json({error:'Expected state object'});
  const allowed=['orders','products','materials','sales','activityLog','nextId'];
  const current=readState()||{...seed};
  for(const k of allowed) if(req.body[k]!==undefined) current[k]=req.body[k];
  try { writeState(current); res.json({ok:true,savedAt:new Date().toISOString()}); }
  catch(e){ console.error(e); res.status(500).json({error:'Could not save shared state'}); }
});
app.listen(PORT,()=>console.log(`AMBAR shared workshop app listening on ${PORT}`));
