import {liveHealth} from './live-health.js';
import {setupEatingAnimation} from './character-animation.js';
import {setupRoamingCat} from './roaming-cat.js';
import {ReplyPanelTimer} from './reply-panel.js';
import {SpeechQueue} from './speech-queue.js';
import {mountGiftFlourish} from './gift-flourish.js';
import {mountAtticRadio, updateAtticRadio} from './attic-radio.js';
import {mountAtticCharacter} from './attic-character.js';
import {mountLiveProgram} from './live-program.js';
import {mountTurtleGame} from './turtle-game.js';
import {mountDrawGame} from './draw-game.js';
import {gameHostCueValid} from './game-host-cue.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stageOnly=new URLSearchParams(location.search).has('stage');
const portraitLayout=new URLSearchParams(location.search).get('layout')==='portrait';
if(portraitLayout)document.body.classList.add('portrait-layout');
const hdDesign=portraitLayout&&new URLSearchParams(location.search).get('design')==='hd';
const atticDesign=portraitLayout&&![ 'hd', 'ocean' ].includes(new URLSearchParams(location.search).get('design'));
if(atticDesign)document.body.classList.add('attic-layout');
if(hdDesign){document.body.classList.add('portrait-redesign');const style=document.createElement('link');style.rel='stylesheet';style.href='/portrait-hd.css';document.head.append(style);}
const silentOutput=new URLSearchParams(location.search).has('silent');
if(stageOnly)document.body.classList.add('stage-only');
if(silentOutput){document.body.classList.add('silent-output');$('#voice-enable').hidden=true;}
let state={}, config={}, voiceEnabled=true, toastTimer, lastComments='',lastSongs='',lastLogs='',lastReply='', speechBusy=false;
let playlistPage=0,playlistKey='';
let audioContext, audioSource, speechController, speechVersion=0;
let audioReplyId=null;
let finishSpeech=null;
let gameSpeechAttempt=null,gameSpeechRetryAt=0,completedGameSpeech=null,pendingGameAck=null;
let activeGameCue=null;
const speechQueue=new SpeechQueue({play:async reply=>{activeGameCue=['game-host','turtle','program'].includes(reply.kind)?reply:null;try{await speak(reply.text,reply.voiceRate,config.voicePreset,reply.id,activeGameCue);}finally{if(activeGameCue?.id===reply.id)activeGameCue=null;}},onStart:showReply,paused:()=>!state.running||!!(state.effect?.expiresAt>Date.now()),isValid:reply=>gameHostCueValid(reply,state)});
function recoverGameSpeech(){
 const game=state.drawGame,reply=state.reply;
 if(game?.phase!=='settlement'||reply?.id!==game.settlementId||!state.running||!config.speech||silentOutput||!voiceEnabled||audioContext?.state!=='running'||completedGameSpeech===reply.id)return;
 if(speechQueue.current===reply.id||speechQueue.items.some(item=>item.reply.id===reply.id))return;
 if(gameSpeechAttempt===reply.id&&Date.now()<gameSpeechRetryAt)return;
 gameSpeechAttempt=reply.id;gameSpeechRetryAt=Date.now()+15000;speechQueue.enqueue({...reply,voiceRate:config.voiceRate});
}
async function acknowledgeGameSpeech(){if(!pendingGameAck)return;try{const result=await api('draw-game/speech-ended',{id:pendingGameAck});if(result.accepted||state.drawGame?.phase!=='settlement')pendingGameAck=null;}catch{}}
setInterval(()=>{recoverGameSpeech();void acknowledgeGameSpeech();},2000);
let turtleAttempt=null,turtleRetryAt=0,pendingTurtleAck=null;
function recoverTurtleSpeech(){
 const g=state.turtleGame,reply=g?.pendingSpeech;
 if(!reply||g.paused||!state.running||!config.speech||silentOutput||!voiceEnabled||audioContext?.state!=='running'||pendingTurtleAck===reply.id)return;
 if(speechQueue.current===reply.id||speechQueue.items.some(item=>item.reply.id===reply.id))return;
 if(turtleAttempt===reply.id&&Date.now()<turtleRetryAt)return;
 turtleAttempt=reply.id;turtleRetryAt=Date.now()+15000;speechQueue.enqueue({...reply,voiceRate:config.voiceRate});
}
async function acknowledgeTurtleSpeech(){if(!pendingTurtleAck)return;const id=pendingTurtleAck;try{const result=await api('turtle-game/speech-ended',{id});if(pendingTurtleAck===id&&(result.accepted||state.turtleGame?.pendingSpeech?.id!==id))pendingTurtleAck=null;}catch{}}
setInterval(()=>{recoverTurtleSpeech();void acknowledgeTurtleSpeech();},2000);
let programAttempt=null,programRetryAt=0,pendingProgramAck=null;
function recoverProgramSpeech(){
 const reply=state.program?.pendingSpeech;
 if(!reply||state.reply?.id!==reply.id||!state.running||!state.program.enabled||!config.speech||silentOutput||!voiceEnabled||audioContext?.state!=='running'||pendingProgramAck===reply.id)return;
 if(speechQueue.current===reply.id||speechQueue.items.some(item=>item.reply.id===reply.id))return;
 if(programAttempt===reply.id&&Date.now()<programRetryAt)return;
 programAttempt=reply.id;programRetryAt=Date.now()+15000;speechQueue.enqueue({...reply,voiceRate:config.voiceRate});
}
async function acknowledgeProgramSpeech(){if(!pendingProgramAck)return;const id=pendingProgramAck;try{const r=await api('program/speech-ended',{id});if(pendingProgramAck===id&&(r.accepted||state.program?.pendingSpeech?.id!==id))pendingProgramAck=null;}catch{}}
setInterval(()=>{recoverProgramSpeech();void acknowledgeProgramSpeech();},2000);
let videoSoundEnabled=true;
try{const preference=sessionStorage.getItem('whale-sound');voiceEnabled=preference!=='off';videoSoundEnabled=preference!=='off';}catch{}
let lastEffectId=null,effectTimer;
const scene=$('#scene'), form=$('#settings-form');
const playlistCaption=document.createElement('div');playlistCaption.id='playlist-caption';playlistCaption.className='playlist-caption';
$('#scene-queue').before(playlistCaption);
function renderScenePlaylist(){
 const songs=state.songs||[],size=atticDesign?3:portraitLayout?4:2,pages=Math.ceil(songs.length/size);
 playlistPage=pages?playlistPage%pages:0;
 const start=playlistPage*size;
 playlistCaption.textContent=songs.length?`待播歌单 · ${start+1}–${Math.min(start+size,songs.length)} / ${songs.length}`:'待播歌单 · 0 首';
 $('#scene-queue').replaceChildren(...songs.slice(start,start+size).map((song,index)=>{
   const li=node('li');li.dataset.position=String(start+index+1);
   li.append(node('span','queue-song',`${start+index+1}. ${song.title}`),node('small','queue-requester',song.user||'观众'));
   li.title=`第${start+index+1}首 · ${song.title} · ${song.user||'观众'}`;return li;
 }));
 if(!songs.length)$('#scene-queue').append(node('li','portrait-queue-empty','暂无排队歌曲，下一首听你的。'));
}
setInterval(()=>{if((state.songs?.length||0)>(atticDesign?3:portraitLayout?4:2)){playlistPage++;renderScenePlaylist();}},8000);
// These preferences also remain available through the local settings API.
const aiPreferences=document.createElement('fieldset');
aiPreferences.innerHTML='<legend>现场互动</legend><label class="check-label"><input type="checkbox" name="naturalSongs">听懂自然点歌（如“帮我放晴天”）</label><label class="check-label"><input type="checkbox" name="adaptiveThinking">提问、点歌与串词时启用思考</label><label class="check-label"><input type="checkbox" name="idleChatter">安静时播放口头禅（无人在线也播放）</label><label>安静多久后开启话题（秒）<input type="number" name="idleChatterSeconds" min="15" max="1800"></label><p class="hint">主动聊天至少间隔45秒，听歌时至少90秒；口头禅也计入，无人接话时逐步延长至原间隔的4倍，观众发言优先。关注只在合适时轻提醒，提醒后10分钟内不再邀请。常客记录仅按昵称关联，在本机保留最近话题和点歌，30天过期；不会识别真实身份。</p>';
form.querySelector('[data-pane="ai"]').append(aiPreferences);
const mixPreferences=document.createElement('fieldset');
mixPreferences.innerHTML='<legend>音乐与人声</legend><label>音乐音量（0–1）<input name="musicVolume" type="number" min="0" max="1" step="0.05"></label><label class="check-label"><input name="musicDucking" type="checkbox">小鲸说话时自动降低音乐</label><p class="hint">独立播放器会统一歌曲响度；人声开始时降低音乐，结束后平滑恢复。舞蹈期间沿用暂停音乐的规则。</p>';
form.querySelector('[data-pane="ai"]').append(mixPreferences);
if(portraitLayout){
  const brand=node('div','portrait-brand');brand.innerHTML='<span class="portrait-logo" aria-hidden="true"><svg viewBox="0 0 64 64"><ellipse cx="26" cy="34" rx="18" ry="14" fill="#f0b429"/><path d="M40 34c7-1 14-9 18-15-5 4-9 8-11 11 2 3 7 6 12 8-6-5-12-7-19-4z" fill="#e09a12"/><circle cx="18" cy="30" r="2.1" fill="#3d2a12"/><ellipse cx="13" cy="37" rx="3" ry="1.7" fill="#ff8fa8"/><path d="M16 40c2.6 2 6.4 2 9 0" fill="none" stroke="#fff7df" stroke-width="1.7" stroke-linecap="round"/></svg></span><div><strong>大肥鱼 <small>FAT FISH LIVE</small></strong><span>深海电台 · 陪你干饭</span></div>';scene.append(brand);
  scene.append(node('div','portrait-subtitle','陪你聊天 · 听你点歌 · 把每一条弹幕接住'));
  $('.scene-title strong').textContent='今天也要开心干饭';
  $('.chat h2').innerHTML='<span>◎</span> 弹幕<small id="comment-count">0 条</small>';
  $('.rules').innerHTML='<h2><span>♫</span> 点歌</h2><p class="portrait-song-hint">弹幕写下歌名，马上排进电台</p><div class="portrait-song-command">点歌 歌名</div>';
  $('.music h2').innerHTML='<span>♪</span> 正在听';
  $('.host-name').lastChild.textContent=' 大肥鱼';
  $('.chat-empty').innerHTML='<h3>海面还安静</h3><p>来跟大肥鱼说句话，<br>或者点一首想听的歌。</p>';
  $('#reply-question').textContent='大肥鱼的海底电台已就位';
  $('#reply-text').textContent='嗨，我是大肥鱼。碗里是热饭，海里是你点的歌。';
  // Keep the real UI inside a safe inset for viewers using tall-phone fill mode.
  // The aquarium background and freely roaming cat remain on the full scene.
  if(new URLSearchParams(location.search).get('safe')!=='0'){
    const safeFrame=node('div','portrait-safe-frame');
    safeFrame.append(...scene.childNodes);scene.append(safeFrame);
  }
  if(hdDesign){
    $('.portrait-brand strong').innerHTML='深海来信 <small>WHALE RADIO</small>';
    $('.portrait-brand>div>span').textContent='AI 主播 / 小鲸鱼';
    $('.scene-title strong').innerHTML='把今天，调成喜欢的频率<span>✧</span>';
    $('.portrait-subtitle').textContent='听一首歌 · 说说心事 · 在海底慢慢相遇';
    $('.ocean-sticker').textContent='GOOD THINGS TAKE TIDE';
    $('.chat h2').innerHTML='<span>◌</span> 海面来信<small id="comment-count">0 条</small>';
    $('.music h2').innerHTML='<span>≋</span> 接下来听 <span class="portrait-shell">♫</span>';
    $('.rules').innerHTML='<h2><span>♫</span> 为你点播 <span class="portrait-shell">↗</span></h2><p class="portrait-song-hint">把喜欢的旋律<br>留在这片海里</p><div class="portrait-song-command">点歌 + 歌名</div><div class="portrait-song-callout">弹幕发送，一起听 ♡</div>';
    $('.host-name').lastChild.textContent=' 小鲸鱼说';
    $('.scene-corner').textContent='DEEP BLUE / 温柔的声音，总会有回音';
    const backdrop=node('div','hd-aquarium');backdrop.setAttribute('aria-hidden','true');scene.prepend(backdrop);
  }
}
if(atticDesign){mountAtticRadio(scene);void mountAtticCharacter(scene);}
const drawGame=mountDrawGame(scene);
const turtleGame=mountTurtleGame(scene);
const liveProgram=mountLiveProgram(scene);
const replyPanel=new ReplyPanelTimer({show:()=>{$('.reply-card').hidden=false;scene.classList.remove('reply-panel-hidden');},hide:()=>{$('.reply-card').hidden=true;scene.classList.add('reply-panel-hidden');}});
const captionChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('whale-reply-audio'):null;
function captionAudio(type,id,broadcast=true){if(!id)return;reportOutput();if(type==='pending')replyPanel.pending(id);else if(type==='speaking')replyPanel.speaking(id);else if(type==='ended')replyPanel.ended(id);if(broadcast){captionChannel?.postMessage({type,id});if(!silentOutput&&(voiceEnabled||type==='ended'))void fetch('/api/speech-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id})}).catch(()=>{});}}
if(captionChannel)captionChannel.onmessage=event=>{const data=event.data;if(data&&typeof data.id==='string'&&['pending','speaking','ended'].includes(data.type))captionAudio(data.type,data.id,false);};
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle=node('button','secondary motion-toggle');
motionToggle.type='button';motionToggle.id='motion-toggle';
let savedMotion=null;
try{savedMotion=localStorage.getItem('whale-motion');}catch{}
let motionEnabled=savedMotion===null?!motionPreference.matches:savedMotion==='on';
function updateMotion(){document.body.classList.toggle('motion-paused',!motionEnabled);motionToggle.setAttribute('aria-pressed',String(motionEnabled));motionToggle.textContent=motionEnabled?'动效开着呢':'安静模式';motionToggle.title=motionEnabled?'关闭装饰动效':'开启动效（跟随系统减少动态效果设置）';}
motionToggle.addEventListener('click',()=>{motionEnabled=!motionEnabled;try{localStorage.setItem('whale-motion',motionEnabled?'on':'off');}catch{}updateMotion();});
motionPreference.addEventListener('change',e=>{motionEnabled=!e.matches;updateMotion();});
$('.view-actions').prepend(motionToggle);updateMotion();
function displayMessage(message){return String(message).replace(/QQ\s*音乐|QQMusic/gi,'本机播放器');}
function toast(message){$('#toast').textContent=displayMessage(message);$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
async function api(route,data){const response=await fetch(`/api/${route}`,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error || '操作失败');return result;}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function bind(id,fn){$(id).addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await fn(event);}catch(e){toast(e.message);}finally{button.disabled=false;}});}
function renderConfig(next){config=next;for(const id of ['autoReply','speech','songEnabled'])$('#'+id).checked=config[id];if(document.activeElement!==$('#room'))$('#room').value=config.room;renderMusicStatus();}
const outputId=crypto.randomUUID();
function reportOutput(){void api('output-status',{id:outputId,uiVersion:'shared-music-v2',page:location.pathname+location.search,silent:silentOutput,voiceEnabled,videoEnabled:videoSoundEnabled,audioReady:audioContext?.state==='running',fullscreen:!!document.fullscreenElement}).catch(()=>{});}
function renderHealth(){const el=$('#live-health');if(!el)return;el.replaceChildren(...liveHealth(state,state.outputWindows).map(item=>{const cell=node('div','health-item '+item.level);cell.append(node('span','',item.name),node('strong','',item.text));return cell;}));}
setInterval(()=>{reportOutput();renderHealth();},5000);
document.addEventListener('fullscreenchange',reportOutput);
function renderMusicStatus(){
  const el=$('#music-status');if(!el)return;
  const rule=$('#queue-rule');if(rule)rule.textContent=`按入队顺序播放，每首最多4分钟；有排队歌曲时${config.autoAdvanceSeconds>0?'满'+Math.min(config.autoAdvanceSeconds,240)+'秒切歌，超过5首待播时最多60秒':'由主播手动切歌'}。`;
  $('#music-setup').hidden=state.musicBackend==='desk';
  const calibrated=['qqSearchX','qqSearchY','qqResultX','qqResultY'].every(k=>config[k]>0);
  const latest=state.logs?.findLast(l=>/QQ|校准/.test(l.message)&&(/播放|搜索框|窗口|焦点|校准/.test(l.message)));
  let text='',error=false;
  if(state.musicBackend==='desk'){text=state.currentSong?.backend==='desk'?`音乐正在独立播放器中播放，已缓冲到本机。${state.songs?.length?'后续歌曲按顺序播放。':''}`:'独立音乐服务已就绪，收到点歌后自动匹配音源。';if(state.failedSongs?.length)text+=' 最近不可播的歌曲已记录，不影响后续点歌。';}
  else if(!calibrated){text='尚未校准 本机播放器。点歌会入队，但无法播放，请先校准下方两个位置。';error=true;}
  else if(latest?.level==='error'&&!/请先校准/.test(latest.message)){text='上次播放失败：'+latest.message;error=true;}
  else if(!state.running){text='助手已暂停。观众点歌不会入队；已排队歌曲仍可手动播放。';}
  else if(!config.songEnabled){text='观众点歌已关闭，请打开“允许观众点歌”。';}
  else {text=state.songs?.length?(config.autoAdvanceSeconds>0?('已按顺序排队，当前歌曲满'+(state.autoAdvanceSeconds??config.autoAdvanceSeconds)+'秒后自动切到下一首。'):'歌曲已排队，每首最多播放4分钟；也可点击“播放下一首”切歌。'):'本机播放器位置已配置，等待点歌。';}
  el.textContent=displayMessage(text);el.classList.toggle('error',error);
}
function fillForm(){for(const [key,value]of Object.entries(config)){const el=form.elements.namedItem(key);if(el && !['apiKey','clearApiKey'].includes(key)){if(el.type==='checkbox')el.checked=value;else el.value=value;}}form.elements.apiKey.value='';form.elements.clearApiKey.checked=false;$('#key-hint').textContent=(config.hasApiKey?'已保存 API Key。留空保留，输入新密钥可替换。':'尚未填写 API Key。')+' 配置文件为本机明文，请勿分享 data 文件夹。';positionLabels();}
function positionLabels(){for(const [name,prefix]of [['search','qqSearch'],['result','qqResult']]){$('#'+name+'-position').textContent=`X ${form.elements[prefix+'X'].value || 0} / Y ${form.elements[prefix+'Y'].value || 0}`;}}
function hostLine(kind){const name=portraitLayout?'大肥鱼':'小鲸鱼';return kind==='speak'?`${name}在说话`:kind==='think'?`${name}在想啦`:`${name}在等你`;}
function setSpeaking(value){speechBusy=value;scene.classList.toggle('is-speaking',value);scene.classList.toggle('is-thinking',!!state.busy&&!value);$('#host-status').textContent=hostLine(value?'speak':state.busy?'think':'idle');}
function stopSpeech(){const endedId=audioReplyId;audioReplyId=null;speechVersion++;speechController?.abort();speechController=null;if(audioSource){audioSource.onended=null;try{audioSource.stop();}catch{}audioSource=null;}finishSpeech?.();finishSpeech=null;if('speechSynthesis'in window)speechSynthesis.cancel();setSpeaking(false);captionAudio('ended',endedId);}
async function speak(text,rate=config.voiceRate||1.05,preset=config.voicePreset||'cute',replyId=null,gameCue=null){
  if(gameCue&&!gameHostCueValid(gameCue,state))return;
  if(silentOutput || !voiceEnabled || state.effect?.expiresAt>Date.now())return;
  captionAudio('pending',replyId);
  const ready=await Promise.race([resumeAudio(),new Promise(resolve=>setTimeout(()=>resolve(false),500))]);
  if(!ready||!voiceEnabled||state.effect?.expiresAt>Date.now()){captionAudio('ended',replyId);return;}
  stopSpeech();audioReplyId=replyId;const version=speechVersion;const controller=new AbortController();speechController=controller;
  try{
    const response=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,rate,preset}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
    if(!response.ok){const error=await response.json();throw new Error(error.error||'语音生成失败');}
    const bytes=await response.arrayBuffer();if(version!==speechVersion)return;
    const buffer=await audioContext.decodeAudioData(bytes);if(version!==speechVersion)return;
    await audioContext.resume();if(version!==speechVersion)return;
    const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);audioSource=source;
    const ended=new Promise(resolve=>{finishSpeech=resolve;});
    source.onended=()=>{if(version===speechVersion){if(state.program?.pendingSpeech?.id===replyId){pendingProgramAck=replyId;void acknowledgeProgramSpeech();}if(state.turtleGame?.pendingSpeech?.id===replyId){pendingTurtleAck=replyId;void acknowledgeTurtleSpeech();}audioSource=null;audioReplyId=null;setSpeaking(false);captionAudio('ended',replyId);if(state.drawGame?.settlementId===replyId){completedGameSpeech=replyId;pendingGameAck=replyId;void acknowledgeGameSpeech();}finishSpeech?.();finishSpeech=null;}};
    if(document.visibilityState==='visible')await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(version!==speechVersion)return;
    if(gameCue&&!gameHostCueValid(gameCue,state)){stopSpeech();return;}
    source.start();setSpeaking(true);captionAudio('speaking',replyId);await ended;
  }catch(e){if(version!==speechVersion)return;audioReplyId=null;setSpeaking(false);captionAudio('ended',replyId);toast(e.name==='NotAllowedError'?'请点击直播画面右下角启用语音':e.message);throw e;}
}
function showReply(reply){if(!reply)return;replyPanel.newReply(reply.id);$('#reply-question').textContent=`${reply.user}：${reply.question}`;$('#reply-tag').textContent=reply.kind==='idle'?'小鲸碎碎念':reply.kind==='song'?'点歌回执':reply.kind==='likes'?'合并感谢':reply.kind==='host'?'主播驾到':'回复弹幕';const el=$('#reply-text');el.style.fontSize=reply.text.length>70?'1.2cqw':reply.text.length>40?'1.55cqw':'2.05cqw';el.style.webkitLineClamp=reply.text.length>70?'3':'2';el.title=reply.text;el.textContent=reply.text;const card=$('.reply-card');card.classList.remove('reply-arriving');void card.offsetWidth;card.classList.add('reply-arriving');}
function render(next){state=next;renderHealth();
  if(activeGameCue&&!gameHostCueValid(activeGameCue,state))stopSpeech();
  drawGame.render(state.drawGame);
  turtleGame.render(state.turtleGame);
  recoverTurtleSpeech();
  liveProgram.render(state);recoverProgramSpeech();
  const ts=state.turtleGame,operator=$('#turtle-operator-status');if(operator){operator.textContent=ts&&ts.phase!=='off'?`第 ${ts.session||1} 题 · ${{ready:'等待开始煮汤',intro:'读题中',playing:'推理中',judging:'整理问题中',reveal:'揭底讲解中'}[ts.phase]}${ts.paused?' · 已暂停':''}`:'单题6分钟 · 分轮收问 · 每轮最多精选2问 · 合作破案';$('#turtle-replay').hidden=!ts?.pendingSpeech;}
  recoverGameSpeech();
  const game=state.drawGame,gameStatus=$('#draw-operator-status');
  if(gameStatus){gameStatus.textContent=game?.phase==='settlement'?'结算中：等小鲸实际播完再开下一场。若未发声，请检查本窗口声音与语音播报开关。':game?.phase==='drawing'?`第 ${game.session} 场 · 第 ${game.round}/6 轮${game.paused?' · 已暂停':''}`:game?.phase==='ready'?'画板已就位，等待主播弹幕“开始画画”。':'六轮 × 30秒 · 9:20 画面 · 底部预留弹幕区';$('#draw-replay').hidden=game?.phase!=='settlement';}
  if(atticDesign)updateAtticRadio(state);
  scene.classList.toggle('is-thinking',!!state.busy&&!speechBusy);
  renderEffect(state.effect);
  const waitingDances=(state.danceQueue||[]).reduce((sum,order)=>sum+order.remaining,0);
  $('#dance-queue-count').textContent=waitingDances?`${waitingDances} 次舞蹈排队中 · 按送礼顺序播放`:'连送按顺序排队 · 快乐不打烊';
  renderMusicStatus();
  $('#comment-count').textContent=`${state.stats.comments} 条`;$('#stat-comments').textContent=state.stats.comments;$('#reply-count').textContent=state.stats.replies;$('#stat-songs').textContent=state.stats.songs;$('#token-count').textContent=`本次累计 ${state.stats.tokens.toLocaleString()} tokens`;
  $('#connection-detail').textContent=state.connectionDetail+(state.collectorHealth?' · '+state.collectorHealth.detail:'');
  const labels={disconnected:'未连接',connecting:'连接中',watching:'等待新弹幕',receiving:'收到真实弹幕'};$('#connection-chip').textContent=labels[state.connection]||'未连接';$('#scene-connection').textContent=labels[state.connection]||'未连接';
  $('#run').textContent=state.running?'Ⅱ 暂停助手':'▶ 启动助手';$('#run-status').replaceChildren(node('i'),document.createTextNode(state.running?'助手运行中':'助手未启动'));$('.run-actions').classList.toggle('running',state.running);
  if(!speechBusy)$('#host-status').textContent=hostLine(state.busy?'think':'idle');
  const commentKey=state.comments.map(c=>c.id).join()+state.reply?.id;
  if(commentKey!==lastComments){lastComments=commentKey;const list=$('#comment-list');if(state.comments.length){list.replaceChildren(...state.comments.slice(-25).map(c=>{const row=node('div','comment'+(state.reply?.question===c.text&&state.reply?.user===c.user?' replying':'')),avatar=node('span','avatar',Array.from(c.user)[0]||'鱼'),body=node('div','comment-body'),user=node('div','comment-user',c.user);if(c.source==='test')user.append(node('span','test-tag','测试'));body.append(user,node('p','comment-text',c.text));row.append(avatar,body);return row;}));list.scrollTop=list.scrollHeight;const latest=state.comments.at(-1);$('#welcome').textContent=latest.source==='test'?`测试弹幕 · ${latest.user}`:`欢迎 ${latest.user} 来到海底小屋 ♡`;}}
  const songKey=JSON.stringify([state.songs,state.currentSong?.id,state.currentSong?.title,state.currentSong?.user,state.currentSong?.artist,state.currentSong?.status,state.currentSong?.autoplay]);if(songKey!==lastSongs){lastSongs=songKey;$('#queue-count').textContent=`${state.songs.length} 首待播`;$('#queue-caption').textContent=state.songs.length?`${state.songs.length} 首歌在等你`:'还没有排队的歌曲';$('#song-title').textContent=state.currentSong?.title||'下一首，听你的';$('#song-title').title=state.currentSong?.title||'';$('#song-requester').textContent=state.currentSong?`${state.currentSong.autoplay?'随机电台':(state.currentSong.user||'观众')+' 点播'} · ${state.currentSong.artist || '请核对实际播放'}`:'发送「点歌 歌名」加入队列';$('#music-label').textContent=state.currentSong?(state.currentSong.status || '已发送播放指令'):'等待一首好歌';scene.classList.toggle('has-music',!!state.currentSong);
    const nextPlaylistKey=JSON.stringify(state.songs);if(nextPlaylistKey!==playlistKey){playlistKey=nextPlaylistKey;playlistPage=0;}renderScenePlaylist();
    const queue=$('#operator-queue');queue.replaceChildren(...state.songs.map((s,i)=>{const row=node('div','operator-song'),button=node('button','', '×');button.title='移出队列';button.setAttribute('aria-label','移出 '+s.title);button.addEventListener('click',()=>api('song/remove',{id:s.id}).catch(e=>toast(e.message)));row.append(node('span','',`${i+1}. ${s.title}`),node('small','',s.user),button);return row;}));if(!state.songs.length)queue.append(node('p','hint','还没有点歌，等待观众投递好音乐。'));
  }
  if(state.reply&&state.reply.id!==lastReply){lastReply=state.reply.id;if(!speechQueue.busy&&!speechQueue.items.length)showReply(state.reply);}
  void speechQueue.drain();
  const logKey=JSON.stringify(state.logs);if(logKey!==lastLogs){lastLogs=logKey;if(state.logs.length){$('#logs').replaceChildren(...[...state.logs].reverse().map(l=>{const row=node('div','log-row '+l.level),time=node('time','',new Date(l.time).toLocaleTimeString('zh-CN',{hour12:false}));row.append(time,node('span','',displayMessage(l.message)));return row;}));}}
}
async function saveForm(){const values={};for(const el of form.elements){if(!el.name)continue;values[el.name]=el.type==='number'?Number(el.value):el.type==='checkbox'?el.checked:el.value;}const next=await api('settings',values);renderConfig(next);fillForm();return next;}
bind('#settings-open',()=>{fillForm();$('#settings-dialog').showModal();});bind('#settings-close',()=>$('#settings-dialog').close());bind('#open-guide',()=>$('#guide-dialog').showModal());bind('#guide-close',()=>$('#guide-dialog').close());
bind('#music-setup',()=>{fillForm();$('[data-tab="qq"]').click();$('#settings-dialog').showModal();});
for(const dialog of $$('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
for(const tab of $$('[data-tab]'))tab.addEventListener('click',()=>{$$('[data-tab]').forEach(t=>t.classList.toggle('active',t===tab));$$('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==tab.dataset.tab);});
form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{await saveForm();$('#save-status').textContent='已保存 ✓';toast('设置已保存');}catch(e){toast(e.message);}finally{button.disabled=false;}});
for(const id of ['autoReply','speech','songEnabled'])$('#'+id).addEventListener('change',async()=>{try{renderConfig(await api('settings',{[id]:$('#'+id).checked}));if(id==='speech'&&!config.speech){speechQueue.clear();stopSpeech();}}catch(e){$('#'+id).checked=!$('#'+id).checked;toast(e.message);}});
bind('#connect',async()=>{const room=$('#room').value.trim().replace(/^https?:\/\/live\.douyin\.com\/(\d+)\/?(?:\?.*)?$/,'$1');await api('settings',{room});await api('connect',{});toast('直播间已打开，请在 Edge 完成登录和验证');});
bind('#disconnect',()=>api('disconnect',{}));bind('#diagnose',async()=>{const r=await api('diagnose',{});toast(`当前匹配 ${r.count} 个弹幕节点。请发送一条新弹幕检查接收。`);});
bind('#run',async()=>{await api('run',{running:!state.running});});
bind('#test-send',async()=>{await api('test-comment',{user:$('#test-user').value.trim()||'测试观众',text:$('#test-text').value});$('#test-text').value='';if(!state.running)toast('测试弹幕已显示。启动助手后才会回复或处理点歌。');});$('#test-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing)$('#test-send').click();});
bind('#next',()=>api('next',{}));bind('#clear-queue',()=>api('song/clear',{}));
function hideEffect(){clearTimeout(effectTimer);$('#effect-video').pause();$('#effect-stage').hidden=true;$('#effect-sound').hidden=true;scene.classList.remove('effect-playing');}
function showEffectSound(){const video=$('#effect-video');$('#effect-sound').hidden=silentOutput||!video.muted||$('#effect-stage').hidden;}
function effectAudio(){const video=$('#effect-video');video.muted=silentOutput||!videoSoundEnabled;video.volume=1;showEffectSound();}
function renderEffect(effect){
  if(!effect||effect.expiresAt<=Date.now()){if(!effect)lastEffectId=null;hideEffect();return;}
  if(effect.id===lastEffectId)return;
  lastEffectId=effect.id;hideEffect();stopSpeech();
  const video=$('#effect-video');
  // The server selects the local clip; never load arbitrary URLs from chat or state.
  video.src='/effects/pangpang-dance.mp4';effectAudio();
  $('#effect-caption').textContent=effect.giftId?`${effect.source==='test'?'测试礼物 · ':''}感谢 ${effect.user} 的小心心，胖胖为你开跳！`:effect.source==='host'?'主播一声令下，胖胖立刻开跳！':'主播预览 · 胖胖出场，快乐加倍！';
  const start=async()=>{
    if(lastEffectId!==effect.id)return;
    const offset=Math.max(0,(Date.now()-effect.startedAt)/1000);
    if(offset>=video.duration||effect.expiresAt<=Date.now()){hideEffect();return;}
    video.currentTime=offset;$('#effect-stage').hidden=false;scene.classList.add('effect-playing');showEffectSound();
    effectTimer=setTimeout(hideEffect,Math.max(0,effect.expiresAt-Date.now()));
    try{await video.play();}catch(error){
      if(lastEffectId!==effect.id||$('#effect-stage').hidden)return;
      if(error.name==='NotAllowedError'){
        video.muted=true;
        showEffectSound();
        try{await video.play();toast('浏览器需要点击授权声音，请点击视频上的“开启舞蹈声音”');}catch{hideEffect();toast('视频暂时无法播放，请重试');}
      }else{hideEffect();toast('视频暂时无法播放，请重试');}
    }
  };
  video.onloadedmetadata=()=>start();video.onended=hideEffect;
  video.onerror=()=>{hideEffect();toast('胖胖的视频加载失败，请检查本机服务');};
  video.load();
}
bind('#effect-preview',async()=>{const result=await api('effect/preview',{});if(!result.ok)toast(result.message);});
bind('#flourish-preview',async()=>{const result=await api('gift-flourish/preview',{});toast(`礼物特效：${result.name}`);});
bind('#effect-stop',()=>api('effect/stop',{}));bind('#effect-close',()=>api('effect/stop',{}));
bind('#test-api',async()=>{$('#api-result').textContent='正在保存并测试 DeepSeek…';await saveForm();try{const r=await api('test-deepseek',{});$('#api-result').textContent=`连接成功：${r.text}（${r.tokens} tokens）`;}catch(e){$('#api-result').textContent=e.message;throw e;}});
bind('#test-voice',async()=>{await enableVoice(true);$('#voice-result').textContent='正在生成试听…';try{await speak('你好呀，我是小鲸鱼。欢迎来到我的海底小屋，今天也要开开心心哦。',Number(form.elements.voiceRate.value)||1.05,form.elements.voicePreset.value);$('#voice-result').textContent='正在播放试听。喜欢这个声音的话，点击保存设置。';}catch(e){$('#voice-result').textContent=e.message;throw e;}});
for(const [name,prefix]of [['search','qqSearch'],['result','qqResult']])bind('#capture-'+name,async()=>{toast('请在4秒内把鼠标移到 本机播放器的'+(name==='search'?'搜索框':'第一条歌曲名称')+'并停住');const pos=await api('qq/capture',{});form.elements[prefix+'X'].value=pos.x;form.elements[prefix+'Y'].value=pos.y;positionLabels();toast('位置已拾取，请保存设置');});
bind('#fullscreen',async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await scene.parentElement.requestFullscreen();});
bind('#stage-link',()=>{window.open('/?stage=1','whale-live-stage');toast('在直播画面中启用语音；关闭控制台语音可避免重复。');});
const portraitLink=node('button','secondary','↗ 竖屏直播画面');portraitLink.id='portrait-link';portraitLink.type='button';$('#stage-link').after(portraitLink);
bind('#portrait-link',()=>{window.open('/?stage=1&layout=portrait','whale-live-stage');toast('竖屏画面已打开。采集画布使用 1080 × 1920；只在一个窗口启用声音。');});
function voiceButton(){const ready=voiceEnabled&&audioContext?.state==='running';const waiting=voiceEnabled&&!ready;$('#voice-enable').classList.toggle('enabled',ready);$('#voice-enable').classList.toggle('needs-activation',waiting);$('#voice-enable').setAttribute('aria-pressed',String(voiceEnabled));$('#voice-enable').textContent=ready?'♫ 此窗口声音已启用':waiting?'♫ 声音默认开启 · 点击激活':'♫ 启用声音（语音 + 视频）';}
function voiceContext(){if(!audioContext){audioContext=new AudioContext();audioContext.addEventListener('statechange',voiceButton);}return audioContext;}
async function resumeAudio(){if(silentOutput||!voiceEnabled)return false;try{const context=voiceContext();await context.resume();voiceButton();return context.state==='running';}catch{voiceButton();return false;}}
async function enableVoice(force=false){if(voiceEnabled&&audioContext?.state==='running'&&force!==true){voiceEnabled=false;videoSoundEnabled=false;speechQueue.clear();stopSpeech();}else{voiceEnabled=true;videoSoundEnabled=true;}try{sessionStorage.setItem('whale-sound',voiceEnabled?'on':'off');}catch{}effectAudio();voiceButton();if(voiceEnabled&&await resumeAudio())toast('已启用语音和舞蹈声音，请只在一个窗口启用，避免叠音');}
bind('#effect-sound',()=>enableVoice(true));voiceButton();
bind('#voice-enable',()=>enableVoice());
for(const [selector,action]of [['#program-enable','enable'],['#program-disable','disable'],['#program-extra-game','extra-game'],['#program-next-music','next-music'],['#program-extra-music','extra-music']])bind(selector,()=>api('program/control',{action}));
bind('#program-replay',()=>api('program/replay',{}));
bind('#turtle-replay',async()=>{turtleAttempt=null;turtleRetryAt=0;pendingTurtleAck=null;await api('turtle-game/replay',{});recoverTurtleSpeech();});
bind('#draw-replay',async()=>{gameSpeechAttempt=null;gameSpeechRetryAt=0;completedGameSpeech=null;await api('draw-game/replay',{});recoverGameSpeech();});
// Activate default-on audio on ordinary page interaction when Chrome requires a gesture.
function activateDefaultSound(event){if(!event.isTrusted||silentOutput||!voiceEnabled||event.target.closest?.('#voice-enable, #effect-sound'))return;if(audioContext?.state!=='running')void resumeAudio();}
document.addEventListener('click',activateDefaultSound,{capture:true});document.addEventListener('keydown',activateDefaultSound,{capture:true});
if(voiceEnabled&&!silentOutput)void resumeAudio();
const bubbles=$('.bubbles');for(let i=0;i<18;i++){const b=node('i','bubble');b.style.cssText=`--s:${.4+(i%5)*.55}cqw;--x:${(i*19+7)%98}%;--y:${(i*13+4)%90}%;--d:-${i*1.7}s;--duration:${15+i%7*2}s`;bubbles.append(b);}
if(!atticDesign)void setupEatingAnimation(scene);
void setupRoamingCat(scene);
if(atticDesign){$('.reply-card').hidden=true;scene.classList.add('reply-panel-hidden');}
else replyPanel.newReply('initial');
const playGiftFlourish=mountGiftFlourish(scene);
const events=new EventSource('/api/events');events.addEventListener('state',e=>render(JSON.parse(e.data)));events.addEventListener('flourish',e=>playGiftFlourish(JSON.parse(e.data)));events.addEventListener('settings',e=>{renderConfig(JSON.parse(e.data));if(!config.speech){speechQueue.clear();stopSpeech();}});events.addEventListener('reply',e=>{const reply=JSON.parse(e.data);lastReply=reply.id;if(reply.speech&&!silentOutput&&voiceEnabled)speechQueue.enqueue(reply);else showReply(reply);});events.addEventListener('stop',()=>{speechQueue.clear();stopSpeech();});events.onopen=()=>{$('#backend-badge').textContent='● 本机服务已连接';};events.onerror=()=>{$('#backend-badge').textContent='● 服务连接中断';};
api('settings').then(renderConfig).catch(e=>toast('无法连接本机程序：'+e.message));
