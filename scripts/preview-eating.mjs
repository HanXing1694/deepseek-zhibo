import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(os.tmpdir(),'whale-eating-'));
const port=33413,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
let browser,context;
try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`server exited ${code}`)));});
 browser=await chromium.launch({channel:'msedge',headless:true});
 context=await browser.newContext({viewport:{width:1280,height:720}});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/?stage=1&silent=1');await page.locator('.has-eating-animation').waitFor();
 const sprite=page.locator('#eating-sprite');assert.equal(await sprite.isVisible(),true);
 await page.locator('.has-hd-eating').waitFor();
 const frames=sprite.locator('.eating-hd-frame');assert.equal(await frames.count(),6);
 for(const asset of await frames.evaluateAll(images=>images.map(image=>({width:image.naturalWidth,height:image.naturalHeight})))){assert.equal(asset.width,1024);assert.equal(asset.height,1536);}
 const setFrame=async time=>frames.evaluateAll((images,time)=>images.forEach(image=>image.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=time;})),time);
 const visiblePose=async()=>frames.evaluateAll(images=>images.filter(image=>Number(getComputedStyle(image).opacity)>.5).map(image=>image.dataset.pose));
 await setFrame(0);
 await page.screenshot({path:'output/eating-scoop.png'});
 assert.deepEqual(await visiblePose(),['scoop']);
 await setFrame(2000);
 await page.screenshot({path:'output/eating-bite.png'});
 assert.deepEqual(await visiblePose(),['bite']);
 await setFrame(3100);
 await page.screenshot({path:'output/eating-smile.png'});
 assert.deepEqual(await visiblePose(),['smile']);
 // Each transition has continuous intermediate samples; alpha stays constant,
 // including the wrap from smile back to scoop.
 for(const start of [20,30,40,53,72,94]){
   for(const fraction of [.25,.5,.75]){
     await setFrame((start+6*fraction)*38);
     const weights=await frames.evaluateAll(images=>images.map(image=>Number(getComputedStyle(image).opacity)).filter(value=>value>0));
     assert.equal(weights.length,2);
     assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<.001);
     assert.ok(weights.some(value=>Math.abs(value-fraction)<.001));
   }
 }
 await frames.evaluateAll(images=>images.forEach(image=>image.getAnimations().forEach(animation=>{animation.currentTime=0;animation.play();})));
 const clip=await page.evaluate(async()=>{
   const images=[...document.querySelectorAll('.eating-hd-frame')];
   const canvas=document.createElement('canvas');canvas.width=600;canvas.height=900;
   const ctx=canvas.getContext('2d'),stream=canvas.captureStream(60);
   const layer=document.createElement('canvas');layer.width=600;layer.height=900;
   const blend=layer.getContext('2d');
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2000000});
   const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
   let raf;
   function draw(){blend.clearRect(0,0,600,900);blend.globalCompositeOperation='lighter';for(const image of images){blend.globalAlpha=Number(getComputedStyle(image).opacity);if(blend.globalAlpha>0)blend.drawImage(image,0,0,600,900);}ctx.fillStyle='#e0f4f0';ctx.fillRect(0,0,600,900);ctx.drawImage(layer,0,0);raf=requestAnimationFrame(draw);}
   draw();recorder.start();await new Promise(resolve=>setTimeout(resolve,8000));recorder.stop();await stopped;cancelAnimationFrame(raf);stream.getTracks().forEach(track=>track.stop());
   const blob=new Blob(chunks,{type:'video/webm'});
   return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
 });
 await writeFile('output/whale-eating-preview.webm',Buffer.from(clip.split(',')[1],'base64'));
 await page.locator('#scene').evaluate(el=>el.classList.add('is-speaking'));
 assert.equal(await sprite.evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.locator('#scene').evaluate(el=>el.classList.remove('is-speaking'));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await sprite.evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('body').evaluate(el=>el.classList.add('motion-paused'));
 assert.equal(await sprite.evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.locator('body').evaluate(el=>el.classList.remove('motion-paused'));
 assert.deepEqual(errors,[]);
 await context.close();context=null;
 const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(base+'/?silent=1');await mobile.locator('.has-eating-animation').waitFor();
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mobile.screenshot({path:'output/eating-mobile.png',fullPage:true});
 // A failed sprite request leaves the original illustration visible.
 const fallback=await browser.newPage();await fallback.route('**/eating-hd/*.png',route=>route.abort());await fallback.route('**/whale-eating-v1.png',route=>route.abort());await fallback.goto(base+'/?silent=1');
 await fallback.locator('#character').evaluate(el=>el.decode());assert.equal(await fallback.locator('#character').isVisible(),true);
 assert.equal(await fallback.locator('#eating-sprite').isVisible(),false);
 console.log('Eating animation verified: six poses with continuous alpha-preserving transitions and seamless wrap, desktop/mobile layout, speech pause, reduced motion, quiet mode, image-load fallback. 60 fps target preview saved without touching the live room.');
}finally{
 await context?.close();await browser?.close();const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;await rm(dir,{recursive:true,force:true});
}
