const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path')
const {EventEmitter}=require('node:events')
const {createWindowState}=require('../window-state.cjs')
const area={x:0,y:0,width:1280,height:800}
const screen={getPrimaryDisplay:()=>({workArea:area}),getDisplayMatching:()=>({workArea:area})}
test('saved bounds are clamped to an available monitor and maximization survives',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gym-window-'))
 try{await fs.writeFile(path.join(dir,'window-state.json'),JSON.stringify({x:3000,y:2000,width:1400,height:1000,maximized:true}));const s=await createWindowState(dir,screen);assert.deepEqual(s.bounds,area);assert(s.maximized)
 const w=new EventEmitter();w.isDestroyed=()=>false;w.isMinimized=()=>false;w.isMaximized=()=>false;w.getNormalBounds=()=>({x:20,y:30,width:900,height:650});s.bind(w);await s.flush();const restored=await createWindowState(dir,screen);assert.deepEqual(restored.bounds,w.getNormalBounds());assert.equal(restored.maximized,false)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('corrupt or extreme preferences fall back without calling native matching',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gym-window-'))
 try{for(const content of ['invalid',JSON.stringify({x:1e100,y:0,width:1e100,height:600})]){await fs.writeFile(path.join(dir,'window-state.json'),content);const s=await createWindowState(dir,{...screen,getDisplayMatching:()=>{throw Error('must not call')}});assert.equal(s.bounds.width,1100);assert.equal(s.bounds.height,760)}}finally{await fs.rm(dir,{recursive:true,force:true})}
})
