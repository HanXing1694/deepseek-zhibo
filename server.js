import http from 'node:http';
import {Engagement} from './engagement.js';
const engagement=new Engagement();
import {CatchphraseBag,hasAudience} from './catchphrases.js';
const catchphraseBag=new CatchphraseBag();
import {readFile, writeFile, mkdir, unlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {defaults,validateSettings,songFromText,deepseekReply} from './lib.js';
import {SongScheduler,songAdvanceSeconds} from './song-scheduler.js';
import {LikeBatch,isLikeNotice} from './like-batch.js';
import {EffectTrigger,isHostDanceCommand} from './effects.js';
import {EffectPlayback} from './effect-playback.js';
import {HostWelcome,isHostEntry,isRoomEntry,hostNicknameFromTitle} from './host-welcome.js';
import {GiftDanceOrders} from './gift-dance.js';
import {flourishKind,GiftNotices} from './gift-flourish.js';
import {CommentReceipts} from './comment-receipts.js';
import {AudienceMemory,ConversationTurns,liveContext,canIdle,forgetMemory} from './live-context.js';
import {RuntimeStore} from './runtime-store.js';
import {collectorHealth} from './collector-health.js';
import {liveHealth} from './public/live-health.js';
import {LiveProgram,programCommand} from './live-program.js';
import {GameRecords,liveDay} from './game-records.js';
import {TurtleGame,turtleCommand} from './turtle-game.js';
import {judgeTurtle} from './turtle-model.js';
import {DrawAndGuess,drawCommand} from './draw-and-guess.js';
import {DrawHost,revealHostText} from './draw-host.js';
import {gameHostCueValid} from './public/game-host-cue.js';
const outputWindows=new Map();
const root = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = process.env.WHALE_DATA_DIR || path.join(root,'data');
const run = promisify(execFile), port = Number(process.env.PORT || 3210);
await mkdir(dataRoot,{recursive:true});
let config = {...defaults};
try { config = validateSettings(JSON.parse(await readFile(path.join(dataRoot,'settings.json'),'utf8')), defaults); }
catch (e) { if (e.code !== 'ENOENT') console.warn('配置读取失败，使用默认配置：',e.message); }
if (process.env.DEEPSEEK_API_KEY) config.apiKey = process.env.DEEPSEEK_API_KEY;
const clients = new Set();
const state = {connection:'disconnected', connectionDetail:'尚未连接直播间', running:false, comments:[], songs:[], failedSongs:[], currentSong:null, reply:null, effect:null, danceQueue:[],danceReceipts:[],lastGift:null,logs:[], stats:{comments:0,replies:0,tokens:0,songs:0}, busy:false};
const runtimeStore=new RuntimeStore(dataRoot);
let resumeLive=false;
let savedDrawGame;
try{const saved=JSON.parse(await readFile(path.join(dataRoot,'draw-game.json'),'utf8'));if(!process.argv.includes('--fresh')&&saved.version===1&&saved.room===config.room&&Date.now()-saved.savedAt<86400000)savedDrawGame=saved;}catch{}
const drawGame=new DrawAndGuess({saved:savedDrawGame});
let savedTurtle;
try{const saved=JSON.parse(await readFile(path.join(dataRoot,'turtle-game.json'),'utf8'));if(!process.argv.includes('--fresh')&&saved.room===config.room&&saved.version===1&&Date.now()-saved.savedAt<86400000)savedTurtle=saved;}catch{}
const turtleGame=new TurtleGame({saved:savedTurtle});
let savedProgram,savedRecords;
try{const s=JSON.parse(await readFile(path.join(dataRoot,'live-program.json'),'utf8'));if(s.room===config.room){savedRecords=s.records;if(!process.argv.includes('--fresh')){savedProgram=s.program;if(s.draw&&Date.now()-s.savedAt<86400000){const restored=new DrawAndGuess({saved:s.draw});drawGame.data=restored.data;drawGame.recent=restored.recent;drawGame.used=restored.used;}}}}catch{}
const liveProgram=new LiveProgram({saved:savedProgram});
const gameRecords=new GameRecords({saved:savedRecords});
if(turtleGame.active&&liveProgram.active)liveProgram.disable();
let programPublished=null,programSwitchBusy=false,queryNotice=null,lastQueryAt=0;
const programSpoken=new Set(),queryTimes=new Map();
const recordable=event=>event.source==='douyin'||process.env.WHALE_GAME_FIXTURE==='1';
const displayGameDay=()=>drawGame.active&&drawGame.data.sessionId?gameRecords.begin(drawGame.data.sessionId,drawGame.data.startedAt)?.day:liveDay(Date.now());
// If interrupted during a scene switch, retain the already active draw session.
if(drawGame.active&&turtleGame.active)turtleGame.exit();
const gamesActive=()=>drawGame.active||turtleGame.active;

let turtlePublished=null,turtleJudging=false;
const turtleSpoken=new Set();
const drawHost=new DrawHost(drawGame.view()),gameHostReplies=new Map();
let gameTransition=false,gameSpeechPublished=null,gameExitWanted=false,gameWrite=Promise.resolve();
if(process.argv.includes('--resume')) {
  try {
    const saved=JSON.parse(await readFile(path.join(dataRoot,'runtime-restart.json'),'utf8'));
    for(const key of Object.keys(state))if(Object.hasOwn(saved,key))state[key]=saved[key];
    resumeLive=saved.connectionWanted??state.connection!=='disconnected';state.connection='disconnected';state.connectionDetail='正在恢复直播间连接';state.busy=false;
    await unlink(path.join(dataRoot,'runtime-restart.json'));
  }catch(e){console.warn('未恢复运行现场：',e.message);}
}
else if(!process.argv.includes('--fresh')){
 try{const saved=await runtimeStore.load(config.room);if(saved){Object.assign(state,saved);resumeLive=saved.connectionWanted??state.connection!=='disconnected';state.connection='disconnected';state.connectionDetail='正在恢复上次直播现场';state.busy=false;}}
 catch(e){console.warn('自动现场恢复失败：',e.message);}
}
if(state.running){drawGame.resume();turtleGame.resume();}else{drawGame.pause();turtleGame.pause();}
let browserContext, collectorPage, connecting=false, generation=0, replyQueue=[], replyTimer, songBusy=false, songFailed=false, history=[], lastReply=0, historyUpdatedAt=0;
let songAdvanceBusy=false;
let snapshotTimer,stopping=false,wantConnection=resumeLive,reconnectTimer,reconnectAttempts=0,healthBusy=false,healthFailures=0,collectorOpenedAt=0;
let playbackReplyId=null,playbackUntil=0,playbackStage=-1;
const entryWelcomes=new Map();let lastEntryWelcome=0;
function saveRuntime(){const contents=JSON.stringify({...drawGame.snapshot(),version:1,room:config.room}),bundleContents=JSON.stringify({version:2,savedAt:Date.now(),room:config.room,draw:drawGame.snapshot(),program:liveProgram.snapshot(),records:gameRecords.snapshot()});gameWrite=gameWrite.catch(()=>{}).then(async()=>{const file=path.join(dataRoot,'draw-game.json');await writeFile(file+'.tmp',contents,'utf8');await rename(file+'.tmp',file);const turtleFile=path.join(dataRoot,'turtle-game.json');await writeFile(turtleFile+'.tmp',JSON.stringify({...turtleGame.snapshot(),version:1,room:config.room}),'utf8');await rename(turtleFile+'.tmp',turtleFile);const programFile=path.join(dataRoot,'live-program.json');await writeFile(programFile+'.tmp',bundleContents,'utf8');await rename(programFile+'.tmp',programFile);});return Promise.all([runtimeStore.save({...state,connectionWanted:wantConnection},config.room),gameWrite]).catch(e=>console.warn('现场保存失败：',e.message));}
function scheduleReconnect(){
 if(!wantConnection||stopping||connecting||reconnectTimer||reconnectAttempts>=6)return;
 const delay=Math.min(60000,5000*2**reconnectAttempts++);
 state.collectorHealth={status:'reconnecting',detail:`采集连接中断，${delay/1000}秒后自动重连`,attempt:reconnectAttempts};update();
 reconnectTimer=setTimeout(()=>{reconnectTimer=null;if(wantConnection&&!stopping)connect({automatic:true}).catch(()=>scheduleReconnect());},delay);
}
let memoryRecords=[];
try{memoryRecords=JSON.parse(await readFile(path.join(dataRoot,'audience-memory.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')console.warn('常客记录读取失败：',e.message);}
const audienceMemory=new AudienceMemory(memoryRecords);
const conversations=new ConversationTurns();
const memoryRevisions=new Map();
let memoryTimer,memoryWrite=Promise.resolve(),lastAudienceActivity=Date.now(),lastIdle=Date.now(),lastAIChatter=Date.now(),consecutiveCatchphrases=0,activityVersion=0,speechUntil=0;
function flushAudienceMemory(){
 clearTimeout(memoryTimer);memoryTimer=null;const contents=JSON.stringify(audienceMemory.serialize());
 memoryWrite=memoryWrite.catch(()=>{}).then(async()=>{const file=path.join(dataRoot,'audience-memory.json');await writeFile(file+'.tmp',contents,'utf8');await rename(file+'.tmp',file);});return memoryWrite;
}
function rememberAudience(event,song){audienceMemory.remember(event,song);if(event.source==='douyin'&&!memoryTimer)memoryTimer=setTimeout(()=>flushAudienceMemory().catch(e=>log('常客记录保存失败：'+e.message,'warn')),2000);}
function audienceActivity(){lastAudienceActivity=Date.now();lastAIChatter=Date.now();consecutiveCatchphrases=0;activityVersion++;replyQueue=replyQueue.filter(e=>!e.idleNotice);}
let commentRecords=[];
try{const saved=JSON.parse(await readFile(path.join(dataRoot,'comment-receipts.json'),'utf8'));if(Array.isArray(saved))commentRecords=saved.filter(r=>typeof r.key==='string'&&Number.isFinite(r.time)).slice(-10000);}catch(e){if(e.code!=='ENOENT')console.warn('弹幕去重记录读取失败：',e.message);}
const commentReceipts=new CommentReceipts(commentRecords);
for(const event of state.comments.filter(c=>c.source==='douyin'))commentReceipts.remember(config.room,event,{baseline:true});
let receiptTimer,receiptWrite=Promise.resolve();
function flushCommentReceipts(){
 clearTimeout(receiptTimer);receiptTimer=null;const contents=JSON.stringify(commentRecords);
 receiptWrite=receiptWrite.catch(()=>{}).then(async()=>{const file=path.join(dataRoot,'comment-receipts.json');await writeFile(file+'.tmp',contents,'utf8');await rename(file+'.tmp',file);});
 return receiptWrite;
}
function saveCommentReceipts(){if(!receiptTimer)receiptTimer=setTimeout(()=>flushCommentReceipts().catch(e=>console.warn('弹幕去重记录保存失败：',e.message)),2000);}
const songScheduler=new SongScheduler(()=>advanceScheduledSong().catch(e=>{songFailed=true;log(e.message,'error');}));
const songCooldowns = new Map();
const likeBatch = new LikeBatch();
const effectTrigger = new EffectTrigger();
const giftOrders=new GiftDanceOrders(state.danceQueue,state.danceReceipts);
const giftNotices=new GiftNotices();
let giftRetryBlocked=false;
const hostWelcome = new HostWelcome();
let detectedHostNickname='';
let heldSongId=null;
const useDeskMusic=false;
state.musicBackend='removed';
let nextIdleAttempt=0;
const deskMusic={setMix:async()=>{},warm:async()=>({}),resolve:async()=>null,preflight:async()=>null,pause:async()=>({resume:false}),resume:async()=>{},play:async()=>{throw new Error('音乐播放已移除');},status:async()=>({playing:false,position:0,duration:0,volume:0,track:null}),cached:async()=>[],close:async()=>{},ducked:false,worker:{child:null}};
const effectPlayback=new EffectPlayback({
  pause:async()=>{heldSongId=state.currentSong?.id;if(state.currentSong?.backend==='desk')return deskMusic.pause();if(process.platform!=='win32')return {resume:false};return musicSession('pause');},
  resume:async token=>{try{if(token?.backend==='desk')await deskMusic.resume(token);else if(process.platform==='win32')await musicSession('resume',token);}catch(e){songFailed=true;log('舞蹈结束后恢复音乐失败：'+e.message,'error');throw e;}},
  onStart:effect=>{state.effect=effect;log(`${effect.user} 召唤了胖胖跳舞，背景音乐已暂停`);},
  onStop:()=>{state.effect=null;update();},
  onRelease:(elapsed,token)=>{
    if(token.resume&&state.currentSong&&state.currentSong.id===heldSongId)state.currentSong.startedAt+=elapsed;
    update();
    if(giftOrders.count){queueMicrotask(pumpGiftDances);return;}
    if(state.running&&!songBusy){if(state.songs.length&&(state.currentSong?.autoplay||!state.currentSong))queueMicrotask(()=>playNext().catch(e=>log(e.message,'error')));else if(!state.songs.length)queueMicrotask(()=>playIdle());}
  }
});
await deskMusic.setMix({volume:config.musicVolume*(gamesActive()?0.5:1)});
function syncMix(ducked){if(useDeskMusic)void deskMusic.setMix({volume:config.musicVolume*(gamesActive()?0.5:1),ducked:!!ducked&&config.musicDucking}).catch(e=>log('音乐音量恢复失败：'+e.message,'warn'));}
let warmedSongId=null,nextWarmAt=0;
function prepareNextSong(){
 const song=state.songs[0];if(!useDeskMusic||!state.running||!song||songBusy||!state.currentSong||(warmedSongId===song.id&&Date.now()<nextWarmAt))return;
 warmedSongId=song.id;nextWarmAt=Date.now()+8*60000;state.nextSongPreparation={id:song.id,title:song.title,status:'preparing'};
 void deskMusic.warm(song).then(result=>{if(state.songs[0]?.id===song.id){state.nextSongPreparation={id:song.id,title:song.title,status:'ready',source:result.source};update();}}).catch(e=>{if(state.songs[0]?.id===song.id){nextWarmAt=Date.now()+60000;state.nextSongPreparation={id:song.id,title:song.title,status:'failed',detail:e.message};log('下一首音频准备失败，播放时将重新核对：'+e.message,'warn');update();}});
}
const voiceCache = new Map();
let activeVoiceRequests = 0;
let pendingSongRequests = 0;
function songNotice(event,notice){
  if(event.gameOrder||gamesActive()){queryNotice={at:Date.now(),user:event.user,text:notice['已入队']===false||!notice['排队位置']?notice['结果']:(notice['歌名']+'已加入播放队列，第'+notice['排队位置']+'首，游戏中也会依次播放')};update();return;}

  if(replyQueue.length>=10)replyQueue.shift();
  replyQueue.push({...event,songNotice:notice});pumpReplies();
}
async function requestSong(event,query){
  log(`${event.user} 点歌未入队：${query}。点歌已关闭`,'warn');
  songNotice(event,{歌名:query,结果:'点歌已关闭',已入队:false});
}
function broadcast(type, data) { const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; for (const res of clients) res.write(event); }
function update() { state.drawGame=drawGame.view();state.turtleGame=turtleGame.view();state.program=liveProgram.view();state.sharedMusic={title:state.currentSong?.title||null,artist:state.currentSong?.artist||'',user:state.currentSong?.user||'',track:state.currentSong?.id||null,next:state.songs[0]?{title:state.songs[0].title,user:state.songs[0].user}:null,waiting:state.songs.length};const day=displayGameDay();state.gameLeague={day,top:gameRecords.ranking(day).slice(0,3),ranking:gameRecords.ranking(day).slice(0,50),query:queryNotice&&Date.now()-queryNotice.at<12000?queryNotice:null,metrics:gameRecords.metrics(liveProgram.data.cycleId)};state.outputWindows=[...outputWindows.values()].filter(o=>Date.now()-o.updatedAt<16000);state.health=liveHealth(state,state.outputWindows);if(!liveProgram.blocking)prepareNextSong();state.connectionWanted=wantConnection;state.autoAdvanceSeconds=songAdvanceSeconds(config.autoAdvanceSeconds,state.songs.length);songScheduler.sync({running:state.running&&!liveProgram.blocking&&!gameTransition&&!songAdvanceBusy&&!songBusy&&!songFailed&&!effectPlayback.locked&&(!giftOrders.count||gamesActive()),currentSong:state.currentSong,waitingCount:state.songs.length,seconds:config.autoAdvanceSeconds});broadcast('state',state);if(!stopping&&!snapshotTimer)snapshotTimer=setTimeout(()=>{snapshotTimer=null;void saveRuntime();},500); }
async function musicSession(){return {resume:false,sessions:[]};}
async function startEffect(effect){
  if(gamesActive()||liveProgram.blocking||gameTransition){log('游戏进行中，礼物舞蹈保留至返回听歌后播放');return false;}
  if(songBusy){log('播放器正在切歌，请稍后再召唤胖胖','warn');return false;}
  const pending=effectPlayback.start(effect);update();
  try{return await pending;}catch(e){log('舞蹈未播放，无法确认背景音乐已暂停：'+e.message,'error');return false;}
  finally{update();}
}
async function pumpGiftDances(){
  if(gamesActive()||liveProgram.blocking||gameTransition)return;
  if(!state.running||effectPlayback.locked||songBusy||giftRetryBlocked)return;
  const order=giftOrders.peek();if(!order)return;
  const effect=effectTrigger.trigger('',order.user,{gift:true});
  const started=await startEffect({...effect,giftId:order.giftId,source:order.source});
  if(started){giftOrders.consume();update();}
  else{giftRetryBlocked=true;log('礼物舞蹈暂未成功启动，次数保留在队列；请检查播放器后重新启动助手','error');}
}
function celebrateGift(gift,count){
  const kind=flourishKind(gift.name);if(!kind||count<1)return;
  state.lastGift={user:gift.user,name:gift.name,count,source:gift.source,time:Date.now()};
  state.recentGifts=[...(state.recentGifts||[]),state.lastGift].slice(-10);audienceActivity();
  broadcast('flourish',{id:randomUUID(),user:gift.user,name:gift.name,count,kind,time:Date.now()});
}
async function ingestGift(raw,source='gift'){
  const gift={id:`${source}:${String(raw.id||'').slice(0,180)}`,user:String(raw.user||'').trim().slice(0,60),name:typeof raw.name==='string'?raw.name.trim().slice(0,16):'',count:raw.count,source};
  if(!raw.id||!flourishKind(gift.name))return {accepted:0};
  const baseline=source==='gift'&&raw.baseline===true;
  const accepted=gift.name==='小心心'?giftOrders.accept(gift,{baseline}):giftNotices.accept(gift,{baseline});
  if(accepted){
    celebrateGift(gift,accepted);
    log(gift.name==='小心心'?`${source==='test'?'测试礼物 · ':''}${gift.user} 送出${accepted}个小心心，已增加${accepted}次胖胖跳舞`:`${source==='test'?'测试礼物 · ':''}${gift.user} 送出${accepted}个${gift.name}`);
    if(gift.name==='小心心')await pumpGiftDances();
  }
  update();return {accepted};
}
function log(message,level='info') { state.logs.push({time:new Date().toISOString(),message,level}); state.logs=state.logs.slice(-60); update(); }
function settings() { const {apiKey,...rest}=config; return {...rest,hasApiKey:!!apiKey}; }
async function native(){throw new Error('音乐播放已移除');}
let revealWarmScope=null;
function gameQuery(event){
 const now=Date.now();if(now-lastQueryAt<15000||now-(queryTimes.get(event.user)||0)<60000)return;
 lastQueryAt=now;queryTimes.delete(event.user);queryTimes.set(event.user,now);while(queryTimes.size>1000)queryTimes.delete(queryTimes.keys().next().value);
 const day=displayGameDay(),p=gameRecords.profile(event.user,day),top=gameRecords.ranking(day).slice(0,3);
 const text=event.text==='我的战绩'?`今日 ${p.today.score} 分${p.rank?' · 第'+p.rank+'名':''} · 冠军 ${p.today.champions} 次\n近30天：答对 ${p.recent.answers} 题 · 参赛 ${p.recent.games} 场 · 最高 ${p.recent.best} 分`
  :event.text==='今日榜'?(top.length?top.map((r,i)=>`${i+1}. ${[...r.user].slice(0,10).join('')} ${r.score}分`).join(' · '):'今日榜等你来上榜！')+`\n你的今日积分：${p.today.score}${p.rank?' · 第'+p.rank+'名':''}`
  :drawGame.active?'直接发弹幕猜答案；公布前首位答对2分，其余1分。发送“点歌 歌名”可提前排歌。':turtleGame.active?'发“问：问题”提问，发“猜：完整真相”尝试破案。':'发“点歌 歌名”排歌；我的战绩 / 今日榜可查询成绩。';
 queryNotice={user:event.user,text,at:now};
}
function programSettlementText(){
 const text=drawGame.celebration();if(!liveProgram.active)return Date.now()-engagement.lastFollow>=10*60000?text:text.replace(/(?:喜欢一起猜画的朋友，可以点个关注，下次开播好找到这里！|今天玩得开心的话，可以点个关注，下次继续来抢第一！)/gu,'');
 const base=text.slice(0,text.indexOf('感谢大家的热情参与！')>=0?text.indexOf('感谢大家的热情参与！')+'感谢大家的热情参与！'.length:text.indexOf('感谢大家参与！')+'感谢大家参与！'.length);
 const leader=gameRecords.ranking(displayGameDay())[0];
 if(liveProgram.wantsMusic){const follow=Date.now()-Math.max(engagement.lastFollow,liveProgram.data.followAt||0)>=12*60000?'喜欢猜题和听歌的朋友，可以关注一下，下次回来接着玩。':'';return `${base}${leader?`${leader.user}目前以${leader.score}分领跑今日榜。`:''}这一组猜题结束啦！接下来听十分钟左右的音乐，想听什么发送点歌加歌名。想看自己的成绩，发我的战绩；想看排名，发今日榜；不了解规则，发怎么玩。之后继续猜题，今日成绩接着累积！${follow}`;}
 return `${base}本组已完成${liveProgram.data.completed}场，共${liveProgram.data.gameTarget}场。下一场马上开始，继续一起猜吧！`;
}
async function controlProgram(action){
 if(!['enable','disable','extra-game','extra-music','next-music'].includes(action))throw new Error('无效的节目控制');
 const oldProgramCue=liveProgram.data.pendingSpeech?.id;
 if(action==='enable'){
  if(!state.running||!config.speech)throw new Error('请先启动助手并开启语音播报，再开启轮播');
  if(turtleGame.active)throw new Error('请先返回听歌，再开启猜题音乐轮播');
  if(!liveProgram.enable(drawGame.active))return;if(drawGame.data.phase==='ready'){liveProgram.data.phase='to-draw';liveProgram.opening();programPublished=null;broadcast('stop',{});publishProgram();}
 }else if(!liveProgram.control(action))throw new Error('该操作不适用于当前节目阶段');
 if(oldProgramCue&&liveProgram.data.pendingSpeech?.id!==oldProgramCue){if(programPublished===oldProgramCue)broadcast('stop',{});programPublished=null;if(playbackReplyId===oldProgramCue){playbackReplyId=null;playbackUntil=0;speechUntil=0;syncMix(false);}}
 if(drawGame.data.phase==='settlement'){drawGame.data.settlementId=randomUUID();gameSpeechPublished=null;broadcast('stop',{});publishGameSettlement();}
 log(({enable:'已开启轮播：五场猜题后听歌10分钟',disable:'已停止自动轮播，当前场景继续', 'extra-game':'本组增加一场猜题','extra-music':'本轮音乐时间延长5分钟','next-music':'本场结算后进入听歌'})[action]);
 await saveRuntime();
}
function publishProgram(){
 const cue=liveProgram.data.pendingSpeech;if(!state.running||!cue||programPublished===cue.id||state.busy||effectPlayback.locked)return;
 if(cue.programCue.type==='warning'&&playbackUntil>Date.now())return;
 // Older capture pages ACK natural playback using the existing draw endpoint.
 // Generic speech-status ended also means failure/stop, so it never advances.
 if(['off','ready'].includes(drawGame.data.phase))drawGame.data.settlementId=cue.id;
 programPublished=cue.id;state.reply=cue;state.stats.replies++;playbackReplyId=cue.id;playbackStage=-1;playbackUntil=config.speech?Date.now()+45000:0;update();broadcast('reply',{...cue,speech:config.speech,voiceRate:config.voiceRate});
}
function completeProgramSpeech(id){
 if(!state.running||!config.speech||!programSpoken.has(id)||liveProgram.data.pendingSpeech?.id!==id)return false;
 if(liveProgram.data.pendingSpeech.programCue.type==='opening'&&drawGame.data.phase!=='ready')return false;
 const result=liveProgram.ended(id);if(!result)return false;
 programSpoken.delete(id);programPublished=null;if(drawGame.data.settlementId===id)delete drawGame.data.settlementId;
 if(result==='start-draw'){drawGame.start();gameRecords.begin(drawGame.data.sessionId,drawGame.data.startedAt);publishGameHost();}
 update();return true;
}
async function pumpProgram(){
 if(!state.running||!liveProgram.active)return;
 if(liveProgram.data.phase==='draw'&&drawGame.data.phase==='off'){liveProgram.disable();update();return;}
 const phase=liveProgram.data.phase;
 if(['to-music','to-draw'].includes(phase)){
  if(programSwitchBusy||songBusy||pendingSongRequests||gameTransition||effectPlayback.locked)return;
  programSwitchBusy=true;const revision=liveProgram.revision;
  try{
   if(phase==='to-music'){
    await handleGameCommand('exit','draw',true);if(revision!==liveProgram.revision||!liveProgram.active)return;
    if(drawGame.active)return;liveProgram.enterMusic();log('本组猜题结束，进入音乐时间；今日战绩与点歌队列已保留');
    if(giftOrders.count)void pumpGiftDances();else if(state.songs.length&&(!state.currentSong||state.currentSong.autoplay))void playNext().catch(e=>log(e.message,'error'));else if(!state.currentSong)void playIdle();
   }else{
    await handleGameCommand('enter','draw',true);if(revision!==liveProgram.revision||!liveProgram.active)return;
    if(drawGame.data.phase==='ready'){liveProgram.opening();programPublished=null;publishProgram();}
   }
  }catch(e){log('节目切换暂未完成：'+e.message,'warn');}
  finally{programSwitchBusy=false;update();}
 }
 if(liveProgram.data.phase==='music'&&state.currentSong?.status==='播放结束'&&liveProgram.boundary())update();
 publishProgram();
}
async function warmGameVoice(){}
function publishGameHost(){
 if(!state.running||liveProgram.blocking)return;
 const game=drawGame.view();
 if(config.speech&&game.phase==='drawing'&&!game.revealed){const scope=`${game.sessionId}:${game.round}`;if(revealWarmScope!==scope){revealWarmScope=scope;void warmGameVoice(revealHostText(game,drawGame.answerForHost()));}}
 const cues=drawHost.observe(game);if(!cues.length)return;
 if(cues.some(cue=>['ready','round','reveal'].includes(cue.gameCue.type)))broadcast('stop',{});
 for(const cue of cues){
  if(!config.speech)continue;
  gameHostReplies.set(cue.id,cue);while(gameHostReplies.size>64)gameHostReplies.delete(gameHostReplies.keys().next().value);
  state.reply=cue;state.stats.replies++;update();
  broadcast('reply',{...cue,speech:config.speech,voiceRate:config.voiceRate});
 }
}
function publishTurtle(){
 const cue=turtleGame.data.pendingSpeech;if(!state.running||!cue||turtlePublished===cue.id)return;
 turtlePublished=cue.id;state.reply=cue;state.stats.replies++;
 playbackReplyId=cue.id;playbackStage=-1;playbackUntil=config.speech?Date.now()+45000:0;
 update();broadcast('reply',{...cue,speech:config.speech,voiceRate:config.voiceRate});
}
async function pumpTurtle(){
 if(!state.running||!turtleGame.active)return;
 turtleGame.tick();publishTurtle();update();
 if(turtleJudging)return;
 const batch=turtleGame.takeBatch();if(!batch)return;
 turtleJudging=true;
 try{const result=await judgeTurtle(config,batch.question,batch.candidates,batch.history);state.stats.tokens+=result.tokens;if(turtleGame.apply(batch,result)){publishTurtle();}}
 catch(e){turtleGame.fail(batch);log('海龟汤：'+e.message,'warn');}
 finally{turtleJudging=false;update();}
}
function publishGameSettlement(){
 const d=drawGame.data;if(!state.running||d.phase!=='settlement')return;gameRecords.begin(d.sessionId,d.startedAt);gameRecords.finish(d.sessionId,drawGame.ranking());liveProgram.settle(d.sessionId);if(gameSpeechPublished===d.settlementId)return;
 gameSpeechPublished=d.settlementId;
 broadcast('stop',{});
 if(state.reply?.id!==d.settlementId)state.stats.replies++;
 state.reply={id:d.settlementId,text:programSettlementText(),kind:'game',user:'大肥鱼',question:'本场你画我猜结算',tokens:0};
 engagement.spoken(state.reply.text,{});if(liveProgram.active&&state.reply.text.includes('可以关注一下'))liveProgram.data.followAt=Date.now();
 playbackReplyId=state.reply.id;playbackStage=-1;playbackUntil=config.speech?Date.now()+45000:0;
 broadcast('reply',{...state.reply,speech:config.speech,voiceRate:config.voiceRate});
 log('本场你画我猜结束，等待小鲸实际播完表扬与感谢后再开场');
}
async function playGameMusic(){
 if(!gamesActive()||!state.running||gameTransition||songBusy||songAdvanceBusy||effectPlayback.locked||!useDeskMusic||gameExitWanted)return;
 const current=state.currentSong;
 const finished=!current||['播放结束','播放异常','恢复播放失败'].includes(current.status)||(current.duration>0&&(current.position||0)>=current.duration-.05);
 if(state.songs.length&&(finished||current?.autoplay)){await playNext();return;}
 if(finished)await playIdle();
}
async function continueProgramMusic(){
 try{if(state.running&&!effectPlayback.locked&&!songBusy){if(state.songs.length)await playNext();else await playIdle();}}
 catch(e){log('节目切换时音乐续播暂未成功：'+e.message,'warn');}
 finally{void pumpProgram();}
}
async function handleGameCommand(command,mode='draw',internal=false){
 if(!internal&&(['enter','exit'].includes(command)||command==='start'&&liveProgram.blocking))liveProgram.disable();
 const game=mode==='turtle'?turtleGame:drawGame;
 const name=mode==='turtle'?'海龟汤':'你画我猜';
 const publish=mode==='turtle'?publishTurtle:publishGameHost;
 if(gameTransition){log('场景正在切换，请稍后重试','warn');return;}
 if(command==='hint'){if(game===turtleGame&&game.hint())publish();return;}
 if(command==='reveal'){if(game===turtleGame&&game.reveal()){broadcast('stop',{});publish();}return;}
 if(command==='start'){if(mode==='turtle'&&(!config.apiKey||!config.speech))throw new Error('海龟汤需要已配置的 DeepSeek 和开启语音播报');if(game.data.phase==='ready'&&game.start()){gameSpeechPublished=null;log(name+'开始');broadcast('stop',{});publish();}return;}
 if(command==='enter'){
  if(gamesActive()){if(!game.active)log('请先发送“返回听歌”结束当前游戏，再发送“'+name+'”','warn');return;}
  if(songBusy||effectPlayback.locked||(!internal&&giftOrders.count)){log('请等当前切歌或礼物舞蹈结束后再进入'+name,'warn');return;}
  gameTransition=true;
  try{
   generation++;replyQueue=[];likeBatch.reset();clearTimeout(replyTimer);broadcast('stop',{});game.enter();gameExitWanted=false;songScheduler.stop();playbackReplyId=null;playbackUntil=0;speechUntil=0;syncMix(false);log('已进入'+name+'，等待主播口令：'+(mode==='turtle'?'开始煮汤':'开始画画'));
  }finally{gameTransition=false;}
  publish();void playGameMusic();return;
 }
 if(command==='exit'&&game.active){
  if(songBusy){gameExitWanted=true;log('已收到返回听歌口令，当前背景音乐加载结束后自动返回');return;}
  gameExitWanted=false;
  gameTransition=true;
  try{
   game.exit();turtlePublished=null;gameSpeechPublished=null;broadcast('stop',{});playbackReplyId=null;playbackUntil=0;speechUntil=0;syncMix(false);
   log('已退出游戏循环，音乐继续当前歌曲与同一条点歌队列');
  }finally{gameTransition=false;update();}
  if(giftOrders.count)void pumpGiftDances();else if(!state.currentSong)void playIdle();
 }
}
async function playIdle(){return false;}
async function advanceScheduledSong() {
  if(songAdvanceBusy||songBusy||gameTransition||effectPlayback.locked||!state.running||!state.currentSong)return;
  songAdvanceBusy=true;const track=state.currentSong.id;update();
  try{
  // Stop the outgoing audio before loading another track, even with an empty queue.
  if(state.currentSong?.backend==='desk')await deskMusic.pause();
  else await musicSession('pause');
  if(state.currentSong?.id!==track)return;
  state.currentSong.status='播放结束';
  if(liveProgram.boundary()){update();void continueProgramMusic();return;}
  log('歌曲已到切歌时限（每首最多4分钟），继续播放下一首');
  if(state.songs.length)await playNext();else await playIdle();
  update();
  }finally{songAdvanceBusy=false;update();}
}
async function playNext(){throw new Error('音乐播放已移除');}
async function pumpReplies() {
  clearTimeout(replyTimer);
  if(gamesActive()||liveProgram.blocking||liveProgram.data.pendingSpeech||gameTransition)return;
  if(!config.autoReply){replyQueue=replyQueue.filter(event=>event.songNotice||(config.songEnabled&&config.naturalSongs&&event.interpretIntent));likeBatch.reset();}
  if (!state.running || state.busy) return;
  const speechDelay=config.speech?playbackUntil-Date.now():0;
  if(speechDelay>0){replyTimer=setTimeout(pumpReplies,Math.min(speechDelay,1000));return;}
  replyQueue=replyQueue.filter(event=>event.songNotice||!event.time||Date.now()-event.time<(event.entryNotice?20000:60000));
  if(effectPlayback.locked){replyTimer=setTimeout(pumpReplies,Math.max(250,(state.effect?.expiresAt||Date.now()+500)-Date.now()+150));return;}
  if(!replyQueue.length && !likeBatch.count)return;
  if(!replyQueue.length && Date.now()<likeBatch.readyAt){replyTimer=setTimeout(pumpReplies,likeBatch.readyAt-Date.now());return;}
  const delay=config.cooldown*1000-(Date.now()-lastReply);
  if(delay>0) {replyTimer=setTimeout(pumpReplies,delay);return;}
  const event=replyQueue.shift() || likeBatch.take(), epoch=generation,activity=activityVersion,memoryRevision=memoryRevisions.get(event.user); state.busy=true;update();
  try {
    if(event.idleNotice&&(!config.idleChatter||state.songs.length||state.effect||songBusy||pendingSongRequests||giftOrders.count))return;
    if(Date.now()-historyUpdatedAt>10*60*1000)history=[];
    const snapshot=liveContext(state,event.user,config,event.memoryForgotten?null:audienceMemory.replyContext(event));
    if(!event.memoryForgotten&&!event.idleNotice&&recordable(event)){const stats=gameRecords.recall(event.user);if(stats)snapshot['游戏战绩']=stats;}
    let reply;
    try{reply=event.memoryForgotten?{text:'已清除这个昵称在本机的常客记录，之后可以重新认识。',tokens:0}:event.catchphraseNotice?{text:catchphraseBag.next(),tokens:0}:await deepseekReply(config,{...event,conversation:conversations.recent(event.user),engagement:engagement.context(event),liveContext:snapshot},history);}
    catch(error){if(!event.idleNotice)throw error;log('主动聊天暂未生成，使用简短陪伴语：'+error.message,'warn');reply={text:catchphraseBag.next(),tokens:0};}
    if(epoch!==generation || !state.running || gamesActive() || liveProgram.blocking || memoryRevision!==memoryRevisions.get(event.user)) return;
    state.stats.tokens+=reply.tokens;
    if(event.idleNotice&&(activity!==activityVersion||!config.idleChatter||!config.autoReply||state.songs.length||state.effect||songBusy||pendingSongRequests||giftOrders.count))return;
    if(reply.songQuery){
      if(config.songEnabled&&config.naturalSongs){log(`AI 识别自然点歌：${event.user} · ${reply.songQuery}`);await requestSong(event,reply.songQuery);}
      return;
    }
    if(!config.autoReply&&!event.songNotice)return;
    if(snapshot.常客记录?.允许主动提起){audienceMemory.recalled(event.user);if(!memoryTimer)memoryTimer=setTimeout(()=>flushAudienceMemory().catch(e=>log('常客记录保存失败：'+e.message,'warn')),2000);}
    history.push({role:'user',content:JSON.stringify({观众:event.user,...(event.entryNotice||event.hostNotice?{事件:'进入直播间'}:{弹幕:event.text})})},{role:'assistant',content:reply.text}); history=history.slice(-8);
    historyUpdatedAt=Date.now();
    engagement.spoken(reply.text,event);
    if(!event.memoryForgotten&&!event.idleNotice&&!event.entryNotice&&!event.hostNotice&&!event.likeNotice&&!event.songNotice&&!event.danceNotice)conversations.remember(event.user,event.text,reply.text);
    if(event.catchphraseNotice)consecutiveCatchphrases++;
    else if(event.idleNotice){lastAIChatter=Date.now();consecutiveCatchphrases=0;}
    state.reply={...reply,user:event.user,question:event.idleNotice?'小鲸电台 · 碎碎念':event.entryNotice||event.hostNotice?'进入直播间':event.text,id:randomUUID(),kind:event.songNotice?'song':event.hostNotice?'host':event.entryNotice?'entry':event.likeNotice?'likes':event.idleNotice?'idle':'chat',...(event.catchphraseNotice?{catchphrase:true}:{})}; state.stats.replies++;
    // Conservative voice budget also protects older capture pages that do not
    // report audio timing. This affects idle chatter only, never viewer replies.
    speechUntil=config.speech?Date.now()+35000+reply.text.length*600/Math.max(.5,config.voiceRate):0;
    broadcast('reply',{...state.reply,speech:config.speech,voiceRate:config.voiceRate});
    playbackReplyId=state.reply.id;playbackStage=-1;playbackUntil=config.speech?Date.now()+500:0;
    if(event.catchphraseNotice){state.lastCatchphrase={id:state.reply.id,text:reply.text,time:Date.now()};log('口头禅已触发：'+reply.text);}
  }catch(e) {log(e.name==='TimeoutError'?'DeepSeek 请求超时':e.message,'error');}
  finally {state.busy=false;lastReply=Date.now();update();pumpReplies();}
}
async function ingest(raw,source='douyin') {
  const user=String(raw.user || '观众').trim().slice(0,60), text=String(raw.text || '').trim().slice(0,500);
  if(!text) throw new Error('弹幕不能为空');
  const event={id:randomUUID(),user,text,source,time:Date.now(),...(['entry','chat'].includes(raw.kind)?{kind:raw.kind}:{}),...(raw.platformId?{platformId:String(raw.platformId).slice(0,200)}:{})};
  event.kind=isRoomEntry(event)?'entry':'chat';
  engagement.activity(event);
  state.comments.push(event);state.comments=state.comments.slice(-60);state.stats.comments++;
  audienceActivity();
  if(state.running) {
    const hostNickname=config.hostNickname||detectedHostNickname;
    const control=event.kind==='chat'&&programCommand(user,text,hostNickname);
    if(control){await controlProgram(control);update();return event;}
    if(event.kind==='chat'&&forgetMemory(text)&&recordable(event)){
      if(recordable(event))gameRecords.forget(user);audienceMemory.records.delete(user);await flushAudienceMemory();memoryRevisions.set(user,randomUUID());conversations.users.delete(user);history=[];replyQueue=replyQueue.filter(e=>e.user!==user);queryNotice={at:Date.now(),user,text:'已清除这个昵称的常客记录与游戏战绩'};update();return event;
    }
    if(event.kind==='chat'&&['我的战绩','今日榜','怎么玩'].includes(text)){gameQuery(event);update();return event;}
    if(event.kind==='chat'&&recordable(event)&&liveProgram.active)gameRecords.activity(liveProgram.data.cycleId,drawGame.active?'draw':'music',user);
    const turtleControl=event.kind==='chat'&&turtleCommand(user,text,hostNickname);
    if(turtleControl&&(turtleGame.active||turtleControl==='enter')){await handleGameCommand(turtleControl,'turtle');update();return event;}
    if(turtleGame.active){if(event.kind==='chat'){const title=config.songEnabled&&songFromText(text);if(title)await requestSong({...event,gameOrder:true},title);else turtleGame.ingest(user,text);}update();return event;}
    const gameCommand=event.kind==='chat'&&drawCommand(user,text,hostNickname);
    if(gameCommand){await handleGameCommand(gameCommand);update();return event;}
    if(drawGame.active){
      if(event.kind==='chat'){
        const title=config.songEnabled&&songFromText(text);
        if(title){await requestSong({...event,gameOrder:true},title);update();return event;}
        if(drawGame.guess(user,text)&&recordable(event)){const d=drawGame.data,n=d.notice;gameRecords.hit({sessionId:d.sessionId,startedAt:d.startedAt,round:d.round,user,points:n.points,competitive:n.at<d.startedAt+(d.round+1)*30000-5000,at:n.at});await saveRuntime();}
      }
      publishGameSettlement();publishGameHost();update();return event;
    }
    if(config.autoReply&&isHostEntry(event,hostNickname)){
      const welcome=hostWelcome.take(event,hostNickname);
      if(welcome){if(replyQueue.length>=10)replyQueue.pop();replyQueue.unshift(welcome);log(`识别到主播 ${user} 进场，准备专属欢迎`);pumpReplies();}
      update();return event;
    }
    if(event.kind==='entry'){
      const now=Date.now(),last=entryWelcomes.get(user)||0;
      if(config.autoReply&&now-last>=120000&&now-lastEntryWelcome>=15000&&!replyQueue.some(e=>e.entryNotice)&&!state.busy&&playbackUntil<=now){
        entryWelcomes.set(user,now);lastEntryWelcome=now;
        while(entryWelcomes.size>500)entryWelcomes.delete(entryWelcomes.keys().next().value);
        if(replyQueue.length>=10)replyQueue.shift();
        replyQueue.push({...event,entryNotice:true});pumpReplies();
      }
      update();return event;
    }
    if(text.replace(/\s/gu,'').includes('胖胖跳舞')){
      if(isHostDanceCommand(text,user,hostNickname)){
        if(giftOrders.count||effectPlayback.locked){log('主播舞蹈口令暂未执行：先完成当前舞蹈及礼物队列','warn');}
        else{const effect=effectTrigger.trigger(text,user,{hostNickname});if(effect)await startEffect(effect);else log('主播舞蹈口令冷却中，20秒后可再次触发','info');}
        update();return event;
      }
      if(config.autoReply){if(replyQueue.length>=10)replyQueue.shift();replyQueue.push({...event,danceNotice:true});pumpReplies();}
      update();return event;
    }
    const memory=audienceMemory.context(event);
    if(!isLikeNotice(text))rememberAudience(event);
    if(source==='douyin'&&forgetMemory(text)){
      memoryRevisions.delete(user);memoryRevisions.set(user,randomUUID());
      while(memoryRevisions.size>500)memoryRevisions.delete(memoryRevisions.keys().next().value);
      conversations.users.delete(user);history=[];historyUpdatedAt=0;
      replyQueue=replyQueue.filter(e=>e.user!==user);
      if(config.autoReply){replyQueue.push({...event,memoryForgotten:true});pumpReplies();}
      update();return event;
    }
    const title=config.songEnabled && songFromText(text);
    if(title) {
      await requestSong({...event,audienceMemory:memory},title);
    } else if(config.autoReply && isLikeNotice(text)) {
      likeBatch.add();pumpReplies();
    } else if(config.autoReply||(config.songEnabled&&config.naturalSongs&&config.apiKey)) {
      if(replyQueue.length>=10) replyQueue.shift(); replyQueue.push({...event,audienceMemory:memory,interpretIntent:config.songEnabled&&config.naturalSongs});pumpReplies();
    }
  }
  update();return event;
}
async function disconnect({manual=true}={}) {
  if(manual){wantConnection=false;clearTimeout(reconnectTimer);reconnectTimer=null;reconnectAttempts=0;state.collectorHealth={status:'disconnected',detail:'已手动断开，不自动重连'};}
  generation++; const old=browserContext;browserContext=null;collectorPage=null;detectedHostNickname='';
  history=[];historyUpdatedAt=0;replyQueue=[];likeBatch.reset();clearTimeout(replyTimer);
  state.audience=null;state.connection='disconnected';state.connectionDetail='已断开直播间';update();
  if(old) await old.close();
  await flushCommentReceipts();
  await flushAudienceMemory();
}
async function connect(){
  if(process.env.WHALE_COLLECTOR_FIXTURE==='1'){
    state.connection='watching';
    state.connectionDetail='测试观众';
    state.audience={count:Number(process.env.WHALE_AUDIENCE_FIXTURE??0),time:Date.now()};
    update();
    return;
  }
  wantConnection=false;
  state.connection='disconnected';
  state.connectionDetail='直播间网页采集已移除';
  update();
  throw new Error('直播间网页采集已移除');
}
async function checkCollector(){}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new Error('仅接受 JSON 请求');
  let str='';for await(const chunk of req){str+=chunk;if(str.length>32000)throw new Error('请求过大');}return JSON.parse(str || '{}');
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try {
    const url=new URL(req.url,`http://127.0.0.1:${port}`), route=url.pathname;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) {res.writeHead(403);res.end();return;}
    if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)) {res.writeHead(403);res.end();return;}
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.method==='GET' && route==='/api/events') {res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});clients.add(res);res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);req.on('close',()=>clients.delete(res));return;}
    if(req.method==='GET' && route==='/api/settings') return json(settings());
    if(req.method==='GET' && route==='/api/state') return json(state);
    if(req.method==='GET'&&route==='/api/health')return json({checkedAt:Date.now(),items:liveHealth(state,[...outputWindows.values()])});
    if(req.method==='GET'&&route==='/api/music/status')return json({backend:state.musicBackend,currentSong:state.currentSong,player:state.currentSong?.backend==='desk'?await deskMusic.status():await musicSession('status'),failedSongs:state.failedSongs});
    if(req.method==='GET'&&route==='/api/gift-diagnostics')return json({connected:false,removed:true,lastGift:state.lastGift});
    if(req.method==='POST') {
      const data=await body(req);
      if(route==='/api/output-status'){
        if(typeof data.id!=='string'||data.id.length>100)throw new Error('无效的窗口标识');
        for(const [id,output] of outputWindows)if(Date.now()-output.updatedAt>16000)outputWindows.delete(id);
        if(outputWindows.size>=20&&!outputWindows.has(data.id))throw new Error('声音窗口过多');
        outputWindows.set(data.id,{id:data.id,uiVersion:['five-game-v1','shared-music-v2'].includes(data.uiVersion)?data.uiVersion:'legacy',page:typeof data.page==='string'&&data.page.startsWith('/')?data.page.slice(0,200):null,silent:data.silent===true,voiceEnabled:data.voiceEnabled===true,videoEnabled:data.videoEnabled===true,audioReady:data.audioReady===true,fullscreen:data.fullscreen===true,updatedAt:Date.now()});update();return json({ok:true});
      }
      if(route==='/api/speech-status'){
        if(data.type==='pending'&&gameHostReplies.has(data.id)&&gameHostCueValid(gameHostReplies.get(data.id),{running:state.running,drawGame:drawGame.view()})){
          if(playbackReplyId!==data.id){playbackReplyId=data.id;playbackStage=-1;}
        }
        if(data.id===playbackReplyId&&['pending','speaking','ended'].includes(data.type)){
          if(data.type==='speaking'&&liveProgram.data.pendingSpeech?.id===data.id){programSpoken.add(data.id);while(programSpoken.size>16)programSpoken.delete(programSpoken.values().next().value);}
          if(data.type==='speaking'&&turtleGame.data.pendingSpeech?.id===data.id){turtleSpoken.add(data.id);while(turtleSpoken.size>16)turtleSpoken.delete(turtleSpoken.values().next().value);}
          const stage=['pending','speaking','ended'].indexOf(data.type);
          if(stage>=playbackStage){playbackStage=stage;playbackUntil=data.type==='ended'?0:Date.now()+(data.type==='pending'?45000:180000);speechUntil=data.type==='ended'?Date.now():playbackUntil;state.speechPlayback={id:data.id,status:data.type,updatedAt:Date.now()};syncMix(data.type==='speaking');update();if(data.type==='ended')pumpReplies();}
        }
        return json({ok:true});
      }
      if(route==='/api/turtle-game/speech-ended'){
        const accepted=state.running&&config.speech&&turtleSpoken.has(data.id)&&turtleGame.ended(data.id);
        if(accepted){turtleSpoken.delete(data.id);turtlePublished=null;publishTurtle();update();}
        return json({ok:true,accepted:!!accepted});
      }
      if(route==='/api/turtle-game/replay'){
        const ok=turtleGame.active&&turtleGame.replay();if(ok){broadcast('stop',{});turtlePublished=null;publishTurtle();}return json({ok:!!ok});
      }
      if(route==='/api/draw-game/speech-ended'){
        if(liveProgram.data.pendingSpeech?.id===data.id)return json({ok:true,accepted:completeProgramSpeech(data.id)});
        const accepted=state.running&&drawGame.data.phase==='settlement'&&drawGame.data.settlementId===data.id;
        if(accepted){
          if(liveProgram.toMusic()){await pumpProgram();}
          else{drawGame.ended(data.id);log('结算语音已实际播完，自动开始下一场你画我猜');publishGameHost();}
          gameSpeechPublished=null;update();
        }return json({ok:true,accepted:!!accepted});
      }
      if(route==='/api/program/control'){await controlProgram(data.action);update();return json({ok:true});}
      if(route==='/api/program/replay'){if(liveProgram.replay()){broadcast('stop',{});programPublished=null;publishProgram();update();}return json({ok:true});}
      if(route==='/api/program/speech-ended'){
        return json({accepted:completeProgramSpeech(data.id)});
      }
      if(route==='/api/draw-game/replay'){
        if(drawGame.data.phase!=='settlement')return json({ok:false});
        gameSpeechPublished=null;publishGameSettlement();return json({ok:true});
      }
      if(route==='/api/tts'){res.writeHead(410,{'Content-Type':'text/plain; charset=utf-8'});res.end('在线语音已移除');return;}
      if(route==='/api/settings') {
        const input={...data};if(!input.apiKey)delete input.apiKey;if(input.clearApiKey)input.apiKey='';
        const next=validateSettings(input,config);await writeFile(path.join(dataRoot,'settings.json'),JSON.stringify(next,null,2),'utf8');
        if(next.persona!==config.persona){generation++;conversations.clear();history=[];historyUpdatedAt=0;replyQueue=[];likeBatch.reset();clearTimeout(replyTimer);}
        config=next;syncMix(state.speechPlayback?.status==='speaking'&&playbackUntil>Date.now()&&config.speech);
        if(!config.speech){playbackUntil=0;playbackReplyId=null;speechUntil=0;syncMix(false);pumpReplies();}
        if(!config.autoReply){likeBatch.reset();pumpReplies();}
        broadcast('settings',settings());log('设置已保存');return json(settings());
      }
      if(route==='/api/connect'){await connect();return json({ok:true});}
      if(route==='/api/gift-flourish/preview'){
        const samples=[{name:'玫瑰',kind:'roses'},{name:'大啤酒',kind:'beer'},{name:'人气票',kind:'tickets'},{name:'灯牌',kind:'lanterns'},{name:'亲吻',kind:'kiss'},{name:'小心心',kind:'hearts'}];
        const sample=samples[Math.floor(Math.random()*samples.length)];
        broadcast('flourish',{id:randomUUID(),user:'海盐小鱼',name:sample.name,count:3,kind:sample.kind,time:Date.now()});
        return json({ok:true,name:sample.name});
      }
      if(route==='/api/effect/preview'){
        if(giftOrders.count)return json({ok:false,message:'礼物舞蹈正在排队，请先完成观众的舞蹈'});
        const effect=effectTrigger.trigger('', '主播',{preview:true});
        if(!effect)return json({ok:false,message:'胖胖休息一下，20秒内只能召唤一次'});
        return json({ok:await startEffect(effect),message:'无法确认音乐已暂停，请检查播放器后重试'});
      }
      if(route==='/api/effect/stop'){await effectPlayback.stop();state.effect=null;update();return json({ok:true});}
      if(route==='/api/disconnect'){await disconnect();return json({ok:true});}
      if(route==='/api/run') {
        if(typeof data.running!=='boolean')throw new Error('运行状态不正确');
        if(data.running && config.autoReply && !config.apiKey)throw new Error('请先填写 DeepSeek API Key');
        state.running=data.running;generation++;conversations.clear();replyQueue=[];history=[];historyUpdatedAt=0;likeBatch.reset();clearTimeout(replyTimer);songScheduler.stop();
        if(state.running){drawGame.resume();turtleGame.resume();if(liveProgram.replay())programPublished=null;}else{drawGame.pause();turtleGame.pause();liveProgram.pause();}
        playbackUntil=0;playbackReplyId=null;speechUntil=0;syncMix(false);
        audienceActivity();lastIdle=Date.now();
        if(state.running){giftRetryBlocked=false;nextIdleAttempt=0;queueMicrotask(pumpGiftDances);queueMicrotask(()=>playIdle());}
        if(!state.running)await effectPlayback.stop();
        if(!state.running){state.effect=null;broadcast('stop',{});}
        if(state.running&&turtleGame.active){turtlePublished=null;publishTurtle();}
        log(state.running?'助手已启动，等待弹幕':'助手已暂停；QQ 音乐继续当前播放');await saveRuntime();return json({ok:true});
      }
      if(route==='/api/test-comment') return json(await ingest(data,'test'));
      if(route==='/api/test-gift')return json(await ingestGift(data,'test'));
      if(route==='/api/test-deepseek'){const reply=await deepseekReply(config,{user:'主播',text:'你好，请用一句话自我介绍。',liveContext:liveContext(state,'主播',config)});return json(reply);}
      if(route==='/api/next'){if(state.songs.length)await playNext();else if(useDeskMusic){if(state.currentSong)state.currentSong.status='播放结束';nextIdleAttempt=0;await playIdle();}else await playNext();return json({ok:true});}
      if(route==='/api/song/remove'){state.songs=state.songs.filter(s=>s.id!==data.id);update();return json({ok:true});}
      if(route==='/api/song/clear'){state.songs=[];update();return json({ok:true});}
      if(route==='/api/qq/capture'){return json(await native('capture'));}
      if(route==='/api/diagnose') {
        return json({count:0,removed:true});
      }
      return json({error:'接口不存在'},404);
    }
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const name=route==='/'?'/index.html':decodeURIComponent(route), target=path.resolve(root,'public',`.${name}`);
    if(!target.startsWith(path.join(root,'public')+path.sep)) {res.writeHead(403);res.end();return;}
    try {const content=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(content);}
    catch{res.writeHead(404);res.end('Not found');}
  }catch(e){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message}));}
});
setInterval(()=>{for(const c of clients)c.write(': heartbeat\n\n');},15000).unref();
setInterval(()=>void checkCollector(),10000).unref();
setInterval(()=>{if(!stopping)void saveRuntime();},5000).unref();
setInterval(()=>{
 if(liveProgram.data.phase==='music'&&state.running&&!effectPlayback.locked){
  state.programTimer=(state.programTimer||0)+1;
  liveProgram.observeMusic({track:'timer',position:state.programTimer,playing:true,running:true,waiting:state.songs.length});
  if(liveProgram.boundary()){update();void pumpProgram();}
 }
 const now=Date.now(),audiencePresent=hasAudience(state,now,5*60000);
 void pumpProgram();
 if(turtleGame.active){if(gameExitWanted&&!songBusy&&!gameTransition){void handleGameCommand('exit','turtle').catch(e=>log(e.message,'error'));return;}void pumpTurtle();if(state.running)void playGameMusic();if(deskMusic.ducked&&(!config.speech||playbackUntil<=now))syncMix(false);return;}
 if(drawGame.active){if(gameExitWanted&&!songBusy&&!gameTransition){void handleGameCommand('exit',turtleGame.active?'turtle':'draw').catch(e=>log(e.message,'error'));return;}if(state.running){drawGame.tick();publishGameSettlement();publishGameHost();update();void playGameMusic();}if(deskMusic.ducked&&(!config.speech||playbackUntil<=now))syncMix(false);return;}
 if(deskMusic.ducked&&(!config.speech||playbackUntil<=now)){syncMix(false);}
 const musicPlaying=!!state.currentSong&&!['播放结束','播放异常','恢复播放失败'].includes(state.currentSong.status);
 const idleSeconds=engagement.idleSeconds(config.idleChatterSeconds,musicPlaying);
 const nextAt=Math.max(lastAudienceActivity,lastReply,lastIdle,config.speech?speechUntil:0)+idleSeconds*1000;
 const blocked=state.busy||songBusy||pendingSongRequests||replyQueue.length||likeBatch.count||state.effect||state.songs.length||giftOrders.count;
 state.catchphraseStatus={enabled:config.idleChatter&&config.autoReply,intervalSeconds:idleSeconds,configuredSeconds:config.idleChatterSeconds,quietTurns:engagement.quietTurns,audiencePresent,nextAt,waitingFor:!config.idleChatter||!config.autoReply?'disabled':!state.running?'paused':blocked?'interaction':now<nextAt?'silence':null};
 if(liveProgram.blocking||liveProgram.data.pendingSpeech)return;
 if(!canIdle({state,config,queueLength:replyQueue.length,likes:likeBatch.count,pendingSongs:pendingSongRequests,songBusy,idleSeconds,lastActivity:lastAudienceActivity,lastReply,lastIdle,speechUntil:config.speech?speechUntil:0,now}))return;
 const catchphraseNotice=!audiencePresent||consecutiveCatchphrases<2||now-lastAIChatter<idleSeconds*1000;
 lastIdle=now;replyQueue.push({user:'小鲸电台',text:catchphraseNotice?'系统播放一句预设陪伴口头禅。':'结合现场开启一个轻松、容易接话的小话题。',idleNotice:true,catchphraseNotice,time:now});pumpReplies();
},1000).unref();
server.listen(port,'127.0.0.1',()=>{
 console.log(`小鲸直播已启动：http://127.0.0.1:${port}`);
 if(useDeskMusic&&state.currentSong?.backend==='desk'&&(!state.currentSong.duration||(state.currentSong.position||0)<state.currentSong.duration-0.5)){
  songBusy=true;const song=state.currentSong;
  deskMusic.play(song,{position:song.position||0}).then(result=>{if(state.currentSong?.id===song.id){Object.assign(state.currentSong,{status:'正在播放',source:result.source,duration:result.duration,startedAt:Date.now()-(song.position||0)*1000});log('独立音乐播放器已恢复原歌曲及进度');}}).catch(e=>{songFailed=true;state.currentSong.status='恢复播放失败';log('恢复原歌曲失败：'+e.message,'error');}).finally(()=>{songBusy=false;update();if(giftOrders.count)queueMicrotask(pumpGiftDances);});
 }
 update();if(giftOrders.count)queueMicrotask(pumpGiftDances);queueMicrotask(()=>playIdle());if(resumeLive)connect().catch(e=>log(e.message,'error'));
 if(process.argv.includes('--open'))execFile('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{windowsHide:true});
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用，请关闭已运行的程序或设置 PORT。`:e.message);process.exit(1);});
setInterval(async()=>{
 if(useDeskMusic&&state.running&&!songBusy&&!state.songs.length)void playIdle();
 if(!useDeskMusic||!deskMusic.worker.child||songBusy||state.currentSong?.backend!=='desk')return;
 try{const status=await deskMusic.status();if(status.track===state.currentSong.id){const now=Date.now();const previous=state.musicPlayback;liveProgram.observeMusic({track:status.track,position:status.position,playing:status.playing,running:state.running,effect:effectPlayback.locked||songBusy,waiting:state.songs.length});state.musicPlayback={track:status.track,playing:status.playing,position:status.position,duration:status.duration,volume:status.volume,ducked:deskMusic.ducked,normalized:true,checkedAt:now,lastAdvancedAt:status.position>(previous?.position??-1)+0.02?now:previous?.track===status.track?previous.lastAdvancedAt:null};state.currentSong.position=status.position;if(!status.playing&&status.duration>0&&status.position>=status.duration-0.05)state.currentSong.status='播放结束';update();}}catch{}
},2000).unref();
async function shutdown(){if(stopping)return;stopping=true;clearTimeout(reconnectTimer);clearTimeout(snapshotTimer);await saveRuntime();wantConnection=false;state.running=false;clearTimeout(replyTimer);songScheduler.stop();await effectPlayback.stop().catch(()=>{});await deskMusic.close();for(const c of clients)c.end();await browserContext?.close().catch(()=>{});await flushCommentReceipts().catch(()=>{});await flushAudienceMemory().catch(()=>{});server.close(()=>process.exit(0));}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
