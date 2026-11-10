// The supplied illustration is the scenery; only the radio display is live UI.
export function mountAtticRadio(scene){
  const radio=document.createElement('section');
  radio.className='attic-radio';radio.setAttribute('aria-label','肥鱼加班电台 · 实时点歌');
  radio.innerHTML=`<div class="attic-now"><div class="attic-record"><div class="attic-cover" role="img" aria-label="夜色电台封面"></div></div><div class="attic-playing">正在播放</div><div class="attic-track"></div><div class="attic-spectrum" aria-hidden="true">${Array.from({length:28},(_,i)=>`<i style="--bar:${[18,30,22,42,57,36,66,80,52,64,44,35,51,63,42,32,48,27,39,22,31,20,27,18,22,16,20,15][i]}%;--delay:${-i*.13}s"></i>`).join('')}</div><span class="attic-time">00:00 / --:--</span><div class="attic-progress" role="progressbar" aria-label="歌曲播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div><div class="attic-upnext"><h2>点歌队列</h2><div class="attic-queue-slot"></div></div>`;
  radio.querySelector('.attic-track').append(scene.querySelector('#song-title'));
  radio.querySelector('.attic-queue-slot').append(scene.querySelector('#scene-queue'));
  radio.querySelector('.attic-upnext').append(scene.querySelector('#playlist-caption'));
  scene.append(radio);
  // Cover the printed sign with a nearby strip of the same wooden desk. The
  // separate reply paper can now disappear completely between conversations.
  const desk=document.createElement('div');desk.className='attic-desk-clear';desk.setAttribute('aria-hidden','true');scene.append(desk);
  const paper=document.createElement('section');paper.className='attic-reply-paper';
  paper.setAttribute('aria-label','桌沿回复纸条');
  paper.append(scene.querySelector('.reply-card'));scene.append(paper);
  const text=paper.querySelector('#reply-text'),answer=document.createElement('div'),label=document.createElement('strong');
  answer.className='attic-answer-row';label.className='attic-answer-label';label.textContent='肥鱼：';
  text.before(answer);answer.append(label,text);text.setAttribute('aria-live','polite');
  scene.setAttribute('aria-label','肥鱼加班电台 · 暖光阁楼竖屏直播间');
}

export function updateAtticRadio(state){
  const radio=document.querySelector('.attic-radio');if(!radio)return;
  const song=state.currentSong;
  radio.classList.toggle('is-playing',!!song&& !/暂停|结束|失败/.test(song.status||''));
  radio.querySelector('.attic-playing').textContent=song?'正在播放':'等待点播';
  const duration=Number(song?.duration)||0,position=Math.max(0,Number(song?.position)||0);
  const clock=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  radio.querySelector('.attic-time').textContent=`${clock(position)} / ${duration?clock(duration):'--:--'}`;
  const progress=radio.querySelector('.attic-progress'),percent=duration?Math.min(100,position/duration*100):0;
  progress.style.setProperty('--progress',percent+'%');progress.setAttribute('aria-valuenow',String(Math.round(percent)));
}
