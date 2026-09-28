import {_electron as electron} from 'playwright'
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import path from 'node:path'
const profile=await mkdtemp(path.resolve('desktop/test-output/icon-'))
const app=await electron.launch({args:['.'],env:{...process.env,OPENGYM_TEST_DATA:profile}})
try {
 const svg=await readFile('frontend/public/desktop-logo.svg','utf8'), sizes=[16,20,24,32,40,48,64,128,256], buffers=[]
 for(const size of [...sizes,512]){
  const b64=await app.evaluate(async({BrowserWindow},{svg,size})=>{const w=new BrowserWindow({width:Math.max(256,size),height:Math.max(256,size),show:false,frame:false,transparent:true,webPreferences:{offscreen:true}});await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{width:'+size+'px;height:'+size+'px;display:block}</style>'+svg));await new Promise(r=>setTimeout(r,250));const image=await w.webContents.capturePage();w.destroy();return image.crop({x:0,y:0,width:size,height:size}).toPNG().toString('base64')},{svg,size})
  const buf=Buffer.from(b64,'base64');if(buf.readUInt32BE(16)!==size||buf.readUInt32BE(20)!==size)throw Error('Wrong icon raster size '+size);if(size!==512)buffers.push(buf)
 }
 const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length
 sizes.forEach((n,i)=>{const o=6+16*i;header[o]=n===256?0:n;header[o+1]=header[o];header.writeUInt16LE(1,o+4);header.writeUInt16LE(32,o+6);header.writeUInt32LE(buffers[i].length,o+8);header.writeUInt32LE(offset,o+12);offset+=buffers[i].length})
 await writeFile('desktop/icon.ico',Buffer.concat([header,...buffers]));await writeFile('frontend/public/desktop-icon.ico',Buffer.concat([header,...buffers]));console.log('Rendered icon sizes 16–512')
}finally{await app.close()}

