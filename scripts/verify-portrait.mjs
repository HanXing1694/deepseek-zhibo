import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {defaults} from '../lib.js';
const root=path.resolve('public');
const fixtureClients=new Set();
const fixture={connection:'receiving',connectionDetail:'已收到真实弹幕',running:true,busy:false,musicBackend:'desk',logs:[],songs:['深海回响','星海的约定','泡泡夏日','海面上的月光'].map((title,i)=>({id:'song-'+i,title,user:'海盐小鱼'})),failedSongs:[],danceQueue:[],stats:{comments:128,replies:96,tokens:8000,songs:8},currentSong:{title:'海风来信',artist:'小鲸电台',user:'海盐小鱼',status:'正在播放'},comments:[{id:'c1',user:'泡泡',text:'早上好呀！♡',source:'douyin'},{id:'c2',user:'海盐薄荷',text:'今天心情很不错！',source:'douyin'},{id:'c3',user:'星海旅人',text:'小鲸鱼太可爱了！♡',source:'douyin'},{id:'c4',user:'蓝海贝壳',text:'能来一首海风来信吗？',source:'douyin'},{id:'c5',user:'水母团子',text:'一起听歌吃饭～',source:'douyin'}]};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`event: state\ndata: ${JSON.stringify(fixture)}\n\n`);fixtureClients.add(res);req.on('close',()=>{fixtureClients.delete(res);res.end();});return;}
 if(url.pathname==='/api/settings'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...defaults,hasApiKey:true}));return;}
 if(url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixture));return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base+'/?stage=1&layout=portrait&design=ocean&silent=1');
 await page.locator('.has-eating-animation').waitFor();await page.locator('.roaming-cat').waitFor();
 await page.locator('.has-hd-eating').waitFor();
 const hdFrames=await page.locator('.eating-hd-frame').evaluateAll(frames=>frames.map(f=>({pose:f.dataset.pose,width:f.naturalWidth,height:f.naturalHeight})));
 assert.equal(hdFrames.length,6);for(const f of hdFrames){assert.equal(f.width,1024);assert.equal(f.height,1536);}
 for(const [time,pose] of [[0,'scoop'],[1100,'lift'],[1500,'mouth'],[1900,'bite'],[2500,'chew'],[3300,'smile']]){
  const visible=await page.locator('.eating-hd-frame').evaluateAll((frames,time)=>{for(const frame of frames)for(const a of frame.getAnimations()){a.pause();a.currentTime=time;}return frames.filter(f=>Number(getComputedStyle(f).opacity)>.5).map(f=>f.dataset.pose);},time);
  assert.deepEqual(visible,[pose],'Exactly one HD frame is visible at each eating phase');
 }
 await page.locator('.eating-hd-frame').evaluateAll(frames=>frames.forEach(f=>f.getAnimations().forEach(a=>{a.currentTime=0;a.play();})));
 await page.locator('#scene').evaluate(el=>el.classList.add('is-speaking'));
 assert.deepEqual(await page.locator('.eating-hd-frame').evaluateAll(frames=>frames.filter(f=>Number(getComputedStyle(f).opacity)>.5).map(f=>f.dataset.pose)),['scoop']);
 await page.locator('#scene').evaluate(el=>el.classList.remove('is-speaking'));
 await page.locator('#song-title').filter({hasText:'海风来信'}).waitFor();
 const check=async()=>page.evaluate(()=>{const scene=document.querySelector('#scene').getBoundingClientRect();return {width:scene.width,height:scene.height,overflow:document.documentElement.scrollWidth>innerWidth,catPointer:getComputedStyle(document.querySelector('.roaming-cat')).pointerEvents};});
 const full=await check();assert.equal(full.width,1080);assert.equal(full.height,1920);assert.equal(full.overflow,false);
 await page.evaluate(()=>document.querySelector('#comment-list').scrollTop=0);
 const panels=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};return {chat:rect('.chat'),music:rect('.music'),rules:rect('.rules'),hero:rect('.character-wrap'),lastSong:rect('#scene-queue li:last-child')};});
 assert.equal(await page.locator('.chat').isVisible(),false,'The full comment list stays off the live picture');assert.ok(panels.music.x+panels.music.w<=1080*.88,'Playlist stays inside right safe inset');assert.ok(panels.hero.h>=1920*.53);assert.ok(panels.lastSong.bottom<=panels.music.bottom,'Four queued songs fit inside playlist');
 assert.equal(await page.locator('#scene-queue li').count(),4);
 assert.equal(await page.locator('#scene-queue .queue-requester').count(),4);
 assert.ok((await page.locator('#scene-queue .queue-requester').allTextContents()).every(text=>text==='海盐小鱼'));
 const rowLayout=await page.locator('#scene-queue li').first().evaluate(li=>{const title=li.querySelector('.queue-song'),user=li.querySelector('.queue-requester'),a=title.getBoundingClientRect(),b=user.getBoundingClientRect();return {overlap:a.top<b.bottom&&b.top<a.bottom,titleEllipsis:getComputedStyle(title).textOverflow,userEllipsis:getComputedStyle(user).textOverflow};});
 assert.equal(rowLayout.overlap,true,'Song and requester share one line');assert.equal(rowLayout.titleEllipsis,'ellipsis');assert.equal(rowLayout.userEllipsis,'ellipsis');
 assert.match(await page.locator('#song-requester').textContent(),/海盐小鱼 点播/);
 const playlistBounds=await page.evaluate(()=>({bottom:document.querySelector('.music').getBoundingClientRect().bottom,replyTop:document.querySelector('.reply-card').getBoundingClientRect().top}));
 assert.ok(playlistBounds.bottom<=playlistBounds.replyTop-15,'All four song/requester rows remain above the reply panel');
 await page.screenshot({path:'output/portrait-1080.png'});
 await page.evaluate(()=>{const card=document.querySelector('.reply-card');card.hidden=false;document.querySelector('#reply-question').textContent='泡泡：早上好呀';document.querySelector('#reply-text').textContent='早上好呀，欢迎潜入我的海底小屋！一起吃饭、聊天，把今天的小快乐慢慢收集起来吧。';});
 await page.screenshot({path:'output/portrait-reply.png'});
 const safePanels=await page.evaluate(()=>['.portrait-brand','.scene-top','.rules','.music','.reply-card'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,left:r.left,right:r.right};}));
 for(const r of safePanels){assert.ok(r.left>=108&&r.right<=972,`${r.selector} survives 9:20 center crop`);}
 await page.screenshot({path:'output/portrait-safe.png'});
 await page.screenshot({path:'output/portrait-mobile-safe-crop.png',clip:{x:108,y:0,width:864,height:1920}});
 // Check the webpage at the actual OBS render size, before any video encoding.
 await page.setViewportSize({width:1440,height:2560});
 const twoK=await check();assert.equal(twoK.width,1440);assert.equal(twoK.height,2560);
 const sourcePixels=await page.evaluate(async()=>{
  const frame=document.querySelector('.eating-hd-frame'),r=frame.getBoundingClientRect();
  const background=new Image();background.src='/portrait-ocean-v2.png';await background.decode();
  return {character:{source:[frame.naturalWidth,frame.naturalHeight],display:[r.width,r.height]},background:{source:[background.naturalWidth,background.naturalHeight],display:[1440,2560]}};
 });
 await page.screenshot({path:'output/portrait-1440.png'});
 console.log(JSON.stringify({twoK,sourcePixels}));
 await page.setViewportSize({width:390,height:844});const phone=await check();assert.equal(phone.width,390);assert.ok(Math.abs(phone.height-390*16/9)<1);assert.equal(phone.overflow,false);
 await page.screenshot({path:'output/portrait-phone.png'});
 // Local silent preview only: no live gift, player pause, or server state changes.
 await page.setViewportSize({width:1080,height:1920});
 await page.evaluate(async()=>{const stage=document.querySelector('#effect-stage'),video=document.querySelector('#effect-video');stage.hidden=false;document.querySelector('#scene').classList.add('effect-playing');video.muted=true;video.src='/effects/pangpang-dance.mp4';await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('Dance preview decode failed'));video.load();});});
 await page.locator('#effect-stage').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 const dance=await page.evaluate(()=>{const r=document.querySelector('#effect-stage').getBoundingClientRect(),reply=document.querySelector('.reply-card').getBoundingClientRect();return {width:r.width,centerX:r.x+r.width/2,centerY:r.y+r.height/2,bottom:r.bottom,replyTop:reply.top,hostVisibility:getComputedStyle(document.querySelector('.character-wrap')).visibility};});
 assert.ok(Math.abs(dance.centerX-540)<1);assert.ok(Math.abs(dance.centerY-1920*.4)<1);assert.ok(dance.width>760);assert.ok(dance.bottom<dance.replyTop);assert.equal(dance.hostVisibility,'visible');
 await page.screenshot({path:'output/portrait-dance.png'});
 await page.setViewportSize({width:390,height:844});
 const phoneDance=await page.locator('#effect-stage').boundingBox();assert.ok(Math.abs(phoneDance.x+phoneDance.width/2-195)<1);assert.ok(phoneDance.width>275);
 await page.setViewportSize({width:1920,height:1080});await page.goto(base+'/?stage=1&silent=1');await page.locator('.roaming-cat').waitFor();
 const landscape=await check();assert.equal(landscape.width,1920);assert.equal(landscape.height,1080);
 assert.equal(await page.locator('.chat').isVisible(),false,'Landscape also hides the full comment list');
 assert.equal(await page.locator('#scene-queue .queue-requester').count(),2);
 assert.match(await page.locator('#playlist-caption').textContent(),/1–2 \/ 4/);
 await page.goto(base+'/?layout=portrait&design=ocean&silent=1');await page.locator('.roaming-cat').waitFor();
 await page.locator('#fullscreen').click();
 const fullscreen=await page.evaluate(()=>{const el=document.querySelector('#scene'),r=el.getBoundingClientRect(),style=getComputedStyle(el);return {active:document.fullscreenElement===el.parentElement,width:r.width,height:r.height,display:style.display,visibility:style.visibility,transform:style.transform};});
 console.log(JSON.stringify({fullscreen}));
 await page.screenshot({path:'output/portrait-fullscreen.png'});
 assert.equal(fullscreen.active,true);assert.ok(Math.abs(fullscreen.width/fullscreen.height-9/16)<.001,'Portrait ratio survives native fullscreen');assert.ok(Math.abs(fullscreen.height-1080)<1);assert.equal(fullscreen.visibility,'visible');
 await page.evaluate(()=>document.exitFullscreen());
 const fallback=await browser.newPage({viewport:{width:1080,height:1920}});
 await fallback.route('**/eating-hd/bite.png',route=>route.abort());await fallback.goto(base+'/?stage=1&layout=portrait&design=ocean&silent=1');
 await fallback.locator('.has-eating-animation').waitFor();assert.equal(await fallback.locator('.has-hd-eating').count(),0);assert.match(await fallback.locator('#eating-sprite').evaluate(el=>el.style.backgroundImage),/whale-eating-v1/);await fallback.close();
 // Isolated queue fixtures: long queues must reach later requesters without a
 // mouse, and ordinary playback state updates must not reset the page.
 fixture.songs.push(...Array.from({length:4},(_,i)=>({id:'extra-'+i,title:'夜曲与海风'+i,user:i===3?'很长很长的点歌昵称海盐薄荷小鱼':'点歌观众'+i})));
 const playlist=await browser.newPage({viewport:{width:1080,height:1920}});
 await playlist.clock.install();await playlist.goto(base+'/?stage=1&layout=portrait&design=ocean&silent=1');
 await playlist.locator('#playlist-caption').filter({hasText:'1–4 / 8'}).waitFor();
 await playlist.clock.runFor(8000);
 assert.match(await playlist.locator('#playlist-caption').textContent(),/5–8 \/ 8/);
 assert.equal(await playlist.locator('#scene-queue li').first().getAttribute('data-position'),'5');
 assert.equal(await playlist.locator('#scene-queue .queue-requester').first().textContent(),'点歌观众0');
 await playlist.screenshot({path:'output/playlist-later-requesters.png'});
 fixture.currentSong.status='正在播放 · 进度更新';fixture.currentSong.position=42;
 const publish=()=>{for(const response of fixtureClients)response.write(`event: state\ndata: ${JSON.stringify(fixture)}\n\n`);};publish();
 await playlist.locator('#music-label').filter({hasText:'进度更新'}).waitFor();
 assert.equal(await playlist.locator('#scene-queue li').first().getAttribute('data-position'),'5');
 fixture.songs.splice(0,4);publish();await playlist.locator('#playlist-caption').filter({hasText:'1–4 / 4'}).waitFor();
 assert.equal(await playlist.locator('#scene-queue .queue-song').first().textContent(),'1. 夜曲与海风0');
 fixture.songs=[];publish();await playlist.locator('#playlist-caption').filter({hasText:'0 首'}).waitFor();
 assert.equal(await playlist.locator('#scene-queue .queue-requester').count(),0);
 assert.equal(await playlist.locator('#song-title').textContent(),'海风来信');
 fixture.reply={id:'only-current-reply',user:'泡泡',question:'这首歌是谁点的？',text:'是海盐小鱼点的海风来信呀。',kind:'chat'};publish();
 await playlist.locator('#reply-question').filter({hasText:'泡泡：这首歌是谁点的？'}).waitFor();
 assert.equal(await playlist.locator('.reply-card').isVisible(),true);assert.equal(await playlist.locator('.chat').isVisible(),false);
 fixture.comments.push({id:'unanswered',user:'其他观众',text:'这一条还没有回复',source:'douyin'});publish();
 await playlist.locator('#comment-list .comment-text').filter({hasText:'这一条还没有回复'}).waitFor({state:'attached'});
 assert.equal(await playlist.locator('#reply-question').textContent(),'泡泡：这首歌是谁点的？');
 await playlist.screenshot({path:'output/portrait-current-comment-only.png'});await playlist.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({portrait:full,phone,landscape:'1920×1080 preserved',errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
