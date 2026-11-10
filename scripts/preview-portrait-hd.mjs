import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../lib.js';
const root=path.resolve('public');
const fixture={connection:'receiving',connectionDetail:'已收到真实弹幕',running:true,busy:false,musicBackend:'desk',logs:[],songs:['深海回响','星海的约定','泡泡夏日','海面上的月光'].map((title,i)=>({id:'song-'+i,title,user:'海盐小鱼'})),failedSongs:[],danceQueue:[],stats:{comments:128,replies:96,tokens:8000,songs:8},currentSong:{title:'海风来信',artist:'小鲸电台',user:'海盐小鱼',status:'正在播放'},comments:[{id:'c1',user:'泡泡',text:'早上好呀！♡',source:'douyin'},{id:'c2',user:'海盐薄荷',text:'今天心情很不错！',source:'douyin'},{id:'c3',user:'星海旅人',text:'小鲸鱼太可爱了！♡',source:'douyin'},{id:'c4',user:'蓝海贝壳',text:'能来一首海风来信吗？',source:'douyin'},{id:'c5',user:'水母团子',text:'一起听歌吃饭～',source:'douyin'}]};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(fixture)}\n\n`);req.on('close',()=>res.end());return;}
 if(url.pathname==='/api/settings'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...defaults,hasApiKey:true}));return;}
 if(url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixture));return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:2560}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/?stage=1&layout=portrait&design=hd&silent=1');
 await page.locator('.has-hd-eating').waitFor();await page.locator('.roaming-cat').waitFor();
 await page.locator('#song-title').filter({hasText:'海风来信'}).waitFor();
 await page.evaluate(async()=>{const image=new Image();image.src='/aquarium-hd.svg';await image.decode();if(!getComputedStyle(document.querySelector('.hd-aquarium')).backgroundImage.includes('aquarium-hd.svg'))throw new Error('Vector background missing');});
 await page.evaluate(()=>{
  document.querySelector('.reply-card').hidden=false;
  document.querySelector('#reply-text').textContent='欢迎潜入我的海底小屋。一起听歌、吃饭，把今天的小快乐，慢慢收集起来吧。';
  document.querySelectorAll('.character-puppet,.eating-hd-frame').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=0;}));
  document.querySelector('#comment-list').scrollTop=0;
 });
 const geometry=await page.evaluate(()=>Object.fromEntries(['.scene','.portrait-safe-frame','.character-wrap','.chat','.rules','.music','.reply-card','#scene-queue li:last-child'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}];})));
 assert.equal(geometry['.scene'].w,1440);assert.equal(geometry['.scene'].h,2560);
 for(const s of ['.chat','.rules','.music','.reply-card']){assert.ok(geometry[s].x>=144, s+' stays inside phone crop');assert.ok(geometry[s].right<=1296,s+' stays inside phone crop');}
 assert.ok(geometry['#scene-queue li:last-child'].bottom<geometry['.music'].bottom,'Playlist fits');
 await page.screenshot({path:'output/portrait-hd-review-2k.png'});
 await page.setViewportSize({width:1080,height:1920});await page.screenshot({path:'output/portrait-hd-review-1080.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/portrait-hd-review-phone.png'});
 assert.equal(await page.locator('.roaming-cat').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({geometry,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
