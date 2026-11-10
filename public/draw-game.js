export function mountDrawGame(scene){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/draw-game.css';document.head.append(css);
 const root=document.createElement('section');root.className='draw-game';root.hidden=true;root.setAttribute('aria-label','大肥鱼的你画我猜');
 root.innerHTML=`<div class="draw-art"></div><div class="draw-safe"><div class="draw-meta"><span class="draw-round"></span><strong class="draw-timer">00:30</strong><span class="draw-total"></span></div><aside class="draw-ranking"><h2>本场排行榜</h2><ol></ol></aside><div class="draw-word-hint" aria-live="polite"></div><svg class="draw-board" viewBox="0 0 600 480" aria-label="正在逐笔绘画的画板"><g class="draw-strokes"></g><g class="draw-chalk"><rect x="-4" y="-9" width="38" height="15" rx="4" fill="#fff9e8" stroke="#d2b994" stroke-width="2" transform="rotate(35)"/></g></svg><div class="draw-notice" aria-live="polite"></div><div class="draw-hint"><strong>猜猜我画的是什么？</strong><span>弹幕作答 · 首位 +2分 · 其余 +1分</span><small></small></div><div class="draw-music">♫ 随机背景音乐 · 轻声陪伴</div><div class="draw-overlay" hidden><span class="draw-eyebrow">大肥鱼的画画时间</span><h2></h2><p></p><ol></ol><small></small></div></div>`;
 scene.append(root);let game=null,key='',offset=0,paths=[];
 const q=s=>root.querySelector(s),NS='http://www.w3.org/2000/svg';
 const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 const clock=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
 function frame(){if(!game||game.phase==='off')return;const now=game.paused?game.pausedAt:Date.now()+offset;
  q('.draw-timer').textContent=game.phase==='drawing'?clock(Math.max(0,Math.ceil((game.roundEndsAt-now)/1000))):game.phase==='ready'?'准备':'结算';
  q('.draw-total').textContent=game.phase==='drawing'?`本场剩余 ${clock(Math.max(0,Math.ceil((game.endsAt-now)/1000)))}`:game.paused?'助手已暂停':'每场 3 分钟';
  if(game.phase==='drawing'){
   const elapsed=Math.max(0,Math.min(1,(now-(game.roundEndsAt-30000))/15000));const total=paths.reduce((s,p)=>s+p.length,0);let budget=total*elapsed,last;
   for(const p of paths){const amount=Math.max(0,Math.min(p.length,budget));p.el.style.strokeDashoffset=String(p.length-amount);p.el.style.opacity=amount>0?'1':'0';if(amount>0)last=p.el.getPointAtLength(amount);budget-=p.length;}
   q('.draw-chalk').style.display=last?'':'none';if(last)q('.draw-chalk').setAttribute('transform',`translate(${last.x} ${last.y})`);
  }
  q('.draw-notice').hidden=!game.notice||now-game.notice.at>4500;
 }
 setInterval(frame,60);
 return {render(next){game=next||{phase:'off'};const active=game.phase!=='off';root.hidden=!active;scene.classList.toggle('game-mode',active);document.body.classList.toggle('draw-game-active',active);if(!active)return;offset=game.serverNow-Date.now();q('.draw-round').textContent=`第 ${game.round||1} / 6 轮`;
  const boardKey=`${game.sessionId}:${game.round}:${game.phase}`;if(boardKey!==key){key=boardKey;q('.draw-strokes').replaceChildren();paths=(game.strokes||[]).map(points=>{const el=document.createElementNS(NS,'path');el.setAttribute('d',points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' '));q('.draw-strokes').append(el);const length=el.getTotalLength();el.style.strokeDasharray=String(length);return {el,length};});}
  q('.draw-ranking ol').replaceChildren(...(game.scores||[]).slice(0,5).map((s,i)=>{const li=document.createElement('li');li.append(text('b',`${i+1}`),text('span',s.user),text('strong',`${s.score}分`));return li;}));if(!game.scores?.length)q('.draw-ranking ol').append(text('li','首位答对，等你上榜'));
  q('.draw-notice').textContent=game.notice?`+${game.notice.points} ${game.notice.user} 答对啦！`:'';
  q('.draw-word-hint').hidden=game.phase!=='drawing';q('.draw-word-hint').classList.toggle('is-revealed',!!game.revealed);q('.draw-word-hint').textContent=game.revealed?`答案：${game.answer}`:`答案是 ${game.answerLength} 个字`;
  q('.draw-hint strong').textContent=game.revealed?'答案公布啦！':'猜猜我画的是什么？';
  q('.draw-hint span').textContent=game.revealed?'答对仍可 +1分 · 每人每题限一次':'弹幕作答 · 公布前首位 +2分 · 其余 +1分';
  q('.draw-hint small').textContent=game.revealed?(game.round===6?'本轮结束后公布本场排名':'看清答案，准备猜下一幅画！'):game.lastAnswer?`上一轮答案：${game.lastAnswer}`:'前 25 秒抢答 · 最后 5 秒公布答案';
  const overlay=q('.draw-overlay');overlay.hidden=game.phase==='drawing';q('.draw-board').style.visibility=game.phase==='drawing'?'visible':'hidden';
  if(!overlay.hidden){q('.draw-overlay h2').textContent=game.phase==='ready'?'画板准备好啦！':'本场精彩结算';q('.draw-overlay p').textContent=game.phase==='ready'?'等主播说「开始画画」，一起开猜！':'恭喜本场获奖的小伙伴';q('.draw-overlay ol').replaceChildren(...(game.phase==='settlement'?game.scores.slice(0,3):[]).map((s,i)=>text('li',`${['🥇','🥈','🥉'][i]} ${s.user} · ${s.score}分`)));q('.draw-overlay small').textContent=game.phase==='ready'?'共 6 轮 · 首位答对 +2分':'感谢大家参与！小鲸播报结束后自动开始下一场。';if(game.phase==='settlement'&&!game.scores.length)q('.draw-overlay p').textContent='这场暂时无人得分，下场一起加油！';}
  frame();}};
}
