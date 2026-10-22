const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'factory-state.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname, 'public')));
const emptyState = {jobs:[],materials:[],receipts:[],usages:[],corrections:[],seq:1};
function readState(){
  try { return {...emptyState, ...JSON.parse(fs.readFileSync(STATE_FILE,'utf8'))}; }
  catch { return {...emptyState}; }
}
function writeState(state){
  const tmp=STATE_FILE+'.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state,null,2));
  fs.renameSync(tmp, STATE_FILE);
}
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'AMBAR shared factory data'}));
app.get('/api/state', (_req,res)=>res.json(readState()));
app.put('/api/state', (req,res)=>{
  if(!req.body || typeof req.body!=='object' || Array.isArray(req.body)) return res.status(400).json({error:'Expected state object'});
  const allowed=['jobs','materials','receipts','usages','corrections','seq'];
  const next={...emptyState};
  for(const key of allowed) if(req.body[key]!==undefined) next[key]=req.body[key];
  try { writeState(next); res.json({ok:true,savedAt:new Date().toISOString()}); }
  catch(e){ console.error(e); res.status(500).json({error:'Could not save shared state'}); }
});
app.listen(PORT,()=>console.log(`AMBAR shared factory app listening on ${PORT}`));
