export function mountTurtleGame(scene){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/turtle-game.css';document.head.append(css);
 const root=document.createElement('section');root.className='turtle-game';root.hidden=true;root.setAttribute('aria-label','海龟汤合作推理');
 root.innerHTML=`<div class="turtle-art"></div><div class="turtle-safe"><header class="turtle-meta"><span class="turtle-number"></span><strong class="turtle-clock"></strong><span>合作破案</span></header><article class="turtle-surface"><small>⌕ 汤面</small><h2></h2><p></p></article><nav class="turtle-phases" aria-label="推理进度"><span>收集问题</span><i>→</i><span>小鲸回答</span><i>→</i><span>下一轮</span></nav><article class="turtle-current" aria-live="polite"><small></small><b class="turtle-user"></b><h3></h3><strong class="turtle-verdict"></strong><p></p></article><aside class="turtle-clues"><h3>✓ 已确认线索</h3><ul></ul><p></p></aside><div class="turtle-instructions"><strong>弹幕提问：问：你的问题</strong><strong>尝试破案：猜：完整真相</strong><small>每轮精选 2 个问题 · 重复提问合并</small><span></span></div><article class="turtle-reveal" hidden><small>真相揭晓</small><h2>汤底</h2><p></p><strong></strong><span></span><small>小鲸讲解播完，自动开启下一题</small></article></div>`;
 scene.append(root);const q=s=>root.querySelector(s);let game=null,offset=0;
 const clock=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
 function frame(){if(!game||game.phase==='off')return;const now=game.paused?game.pausedAt:Date.now()+offset;
  q('.turtle-clock').textContent=game.paused?'已暂停':game.phase==='ready'?'准备':game.phase==='intro'?'读题':game.phase==='reveal'?'揭底':clock(game.endsAt-now);
  if(game.phase==='playing'&&!game.pendingSpeech){q('.turtle-current small').textContent=`第 ${game.round} 轮 · 收问 ${Math.max(0,Math.ceil((game.collectEndsAt-now)/1000))} 秒`;
   q('.turtle-current p').textContent=`已有 ${game.candidateCount} 个候选 · 每人每轮一问`;}
  q('.turtle-instructions span').textContent=game.receipt&&now-game.receipt.at<6000?`${game.receipt.user?game.receipt.user+'：':''}${game.receipt.text}`:'';
 }
 setInterval(frame,250);
 return {render(next){game=next||{phase:'off'};const active=game.phase!=='off';root.hidden=!active;scene.classList.toggle('turtle-mode',active);document.body.classList.toggle('turtle-game-active',active);if(!active)return;scene.classList.add('game-mode');offset=game.serverNow-Date.now();q('.turtle-number').textContent=`第 ${String(game.session||1).padStart(2,'0')} 题`;
  q('.turtle-surface h2').textContent=game.title||'一起还原故事真相';q('.turtle-surface p').textContent=game.surface||'用是与不是，一步步接近答案。';
  const isAnswer=game.pendingSpeech?.turtleCue.type==='answer',isHint=game.pendingSpeech?.turtleCue.type==='hint';
  q('.turtle-phases').querySelectorAll('span').forEach((n,i)=>n.classList.toggle('active',i===(isAnswer||isHint||game.phase==='judging'?1:0)));
  q('.turtle-user').textContent=isAnswer?`${game.current.user}${game.current.verdict==='已破案'?'猜中啦':game.current.kind==='guess'?'猜':'问'}`:isHint?'小鲸的提示':game.phase==='judging'?'问题已收好':game.phase==='ready'?'等待主播口令':game.phase==='intro'?'小鲸正在读汤面':'轮到大家提问啦';
  q('.turtle-current h3').textContent=isAnswer?game.current.text:isHint?game.hint:game.phase==='judging'?'正在整理本轮代表问题…':game.phase==='ready'?'开始煮汤':game.phase==='intro'?'听完故事，开始推理':'发“问：”提问，发“猜：”破案';
  q('.turtle-verdict').hidden=!isAnswer;q('.turtle-verdict').textContent=game.current?.verdict||'';q('.turtle-verdict').dataset.verdict=game.current?.verdict||'';
  q('.turtle-current small').textContent=isAnswer?`本轮精选 · ${game.current.index} / 2`:isHint?`提示 ${game.hintCount} / 2`:game.phase==='ready'?'主播发送“开始煮汤”即可开场':game.phase==='intro'?'读题语音播完开始六分钟计时':'每轮精选 · 合作破案';
  q('.turtle-current p').textContent=isAnswer?(game.current.verdict==='请拆分提问'?'请改成一个能用“是／不是”回答的问题':game.current.verdict==='部分正确'?'方向接近了，试着补全原因':'线索会保留，后来也能跟上'):isHint?'结合已经确认的线索，继续试试吧':'';
  const ul=q('.turtle-clues ul');ul.replaceChildren(...(game.clues||[]).slice(-3).map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));
  q('.turtle-clues p').textContent=!game.clues?.length?'关键线索将在这里留下':game.hint?`提示：${game.hint}`:'';
  const reveal=game.phase==='reveal';q('.turtle-reveal').hidden=!reveal;root.classList.toggle('is-reveal',reveal);
  if(reveal){q('.turtle-reveal p').textContent=game.bottom;q('.turtle-reveal strong').textContent=game.solver?`恭喜 ${game.solver} 成功破案！`:'感谢大家一起推理';q('.turtle-reveal span').textContent=game.contributors?.length?`线索贡献：${game.contributors.join('、')}`:'每一次提问，都在接近真相';}
  frame();}};
}
