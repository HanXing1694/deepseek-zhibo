import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {questions} from '../draw-and-guess.js';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#eee8da;color:#243e37;font-family:'Microsoft YaHei',sans-serif}h1{font-size:25px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(6,240px);gap:12px}article{background:#fffdf5;border-radius:10px;overflow:hidden}h2{font-size:18px;text-align:center;margin:9px}svg{display:block;width:240px;height:192px;background:#264d42}p{font-size:11px;margin:8px;height:18px;text-align:center;color:#586e66}</style><h1>你画我猜 · 全部${questions.length}道题绘画预览</h1><div class="grid">${questions.map(([answer,aliases,strokes],i)=>`<article><h2>${i+1}. ${escape(answer)}</h2><svg viewBox="0 0 600 480"><g fill="none" stroke="#fff4cd" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${strokes.map(points=>`<polyline points="${points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' ')}"/>`).join('')}</g></svg><p>${escape(aliases.join(' / '))}</p></article>`).join('')}</div>`;
await writeFile('output/drawing-bank-preview.html',html);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1548,height:1000},deviceScaleFactor:1});
 await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/drawing-bank-preview.png',fullPage:true});
 for(let start=0;start<questions.length;start+=30){
  const end=Math.min(start+30,questions.length);
  await page.evaluate(({start,end})=>{
   document.querySelectorAll('article').forEach((el,i)=>el.style.display=i>=start&&i<end?'':'none');
   document.querySelector('h1').textContent=`你画我猜 · 第 ${start+1}–${end} 题`;
  },{start,end});
  await page.screenshot({path:`output/drawing-bank-${String(start+1).padStart(3,'0')}-${String(end).padStart(3,'0')}.png`,fullPage:true});
 }
 console.log(JSON.stringify({questions:questions.length,preview:'output/drawing-bank-preview.png'}));
}finally{await browser.close();}
