import {randomUUID} from 'node:crypto';
import {turtleQuestions} from './turtle-questions.js';
const clean=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export function turtleCommand(user,text,host){if(!host||clean(user)!==clean(host))return null;return ({'海龟汤':'enter','海龜湯':'enter','开始煮汤':'start','開始煮湯':'start','给个提示':'hint','給個提示':'hint','公布汤底':'reveal','公布湯底':'reveal','返回听歌':'exit','返回聽歌':'exit'})[String(text).trim()]||null;}
export class TurtleGame{
 constructor({now=Date.now,random=Math.random,saved}={}){
  this.now=now;this.random=random;this.data=saved?.data||{phase:'off',session:0,used:[]};
  this.revision=0;this.batch=null;
  if(this.data.phase==='judging')this.data.phase='playing';
  const delta=saved?.savedAt&&!this.data.pausedAt?Math.max(0,now()-saved.savedAt):0;this.shift(delta);
 }
 get active(){return this.data.phase!=='off';}
 get question(){return turtleQuestions.find(q=>q.id===this.data.questionId);}
 shift(delta){for(const k of ['startedAt','endsAt','collectEndsAt'])if(this.data[k])this.data[k]+=delta;for(const c of this.data.candidates||[])c.at+=delta;}
 snapshot(){return {data:structuredClone(this.data),savedAt:this.now()};}
 enter(heldSong=null){if(this.active)return false;this.data={phase:'ready',session:this.data.session||0,used:this.data.used||[],heldSong,gameId:randomUUID()};this.cue('ready','海龟汤准备好啦！用问加冒号提问，用猜加冒号还原真相。每轮精选两个问题，大家一起破案！');return true;}
 start(){if(this.data.phase!=='ready')return false;this.next();return true;}
 next(){
  const d=this.data;let available=turtleQuestions.filter(q=>!d.used.includes(q.id));if(!available.length){d.used=[];available=turtleQuestions.filter(q=>q.id!==d.questionId);}
  const q=available[Math.floor(this.random()*available.length)];d.used.push(q.id);this.revision++;this.batch=null;
  Object.assign(d,{phase:'intro',session:d.session+1,sessionId:randomUUID(),questionId:q.id,candidates:[],history:[],clues:[],contributors:[],solver:null,hintCount:0,round:1,emptyRounds:0,roundUsers:[],guessTimes:[],receipt:null,current:null,answerQueue:[],endsAt:null,startedAt:null,collectEndsAt:null});
  this.cue('intro',`第${d.session}题，${q.title}。${q.surface}大家通过弹幕提问，一起找出真相！`);
 }
 cue(type,text){this.data.pendingSpeech={id:randomUUID(),kind:'turtle',user:'小鲸',question:'海龟汤 · 现场主持',text,tokens:0,turtleCue:{gameId:this.data.gameId,sessionId:this.data.sessionId,type}};}
 ended(id){const d=this.data,p=d.pendingSpeech;if(!this.active||d.pausedAt||p?.id!==id)return false;d.pendingSpeech=null;
  if(p.turtleCue.type==='intro'){d.phase='playing';d.startedAt=this.now();d.endsAt=this.now()+360000;d.collectEndsAt=this.now()+15000;}
  else if(p.turtleCue.type==='reveal'){this.next();}
  else if(p.turtleCue.type==='answer'){if(d.solver)this.reveal();else if(this.now()>=d.endsAt)this.reveal();else if(d.answerQueue.length)this.showAnswer();else this.collect();}
  else if(p.turtleCue.type==='hint'&&d.phase==='playing'){if(this.now()>=d.endsAt)this.reveal();else if(d.answerQueue.length)this.showAnswer();else this.collect();}
  return true;
 }
 collect(){const d=this.data;d.phase='playing';d.round++;d.roundUsers=[];d.collectEndsAt=this.now()+15000;}
 ingest(user,text){
  const d=this.data;if(!['playing','judging'].includes(d.phase)||d.pausedAt||this.now()>=d.endsAt)return false;
  const m=String(text).trim().match(/^(问|問|猜)\s*[:：]\s*(.+)$/u);if(!m)return false;
  const value=m[2].trim();if(!value||value.length>180)return false;
  const kind=m[1]==='猜'?'guess':'ask',normalized=clean(value);if(!normalized)return false;
  const previous=d.history.find(h=>h.normalized===normalized);
  if(previous){d.receipt={user,text:`这个问题已答过：${previous.verdict}`,at:this.now()};return false;}
  this.prune();
  if(d.candidates.some(c=>c.normalized===normalized)){d.receipt={user,text:'相同问题已合并，等待本轮精选',at:this.now()};return false;}
  // A person can have one pending candidate; guesses do not bypass spam limits.
  if(d.roundUsers.includes(user)||d.candidates.some(c=>c.user===user)){d.receipt={user,text:'每人每轮一个问题，下一轮再来',at:this.now()};return false;}
  const recent=d.guessTimes.find(c=>c.user===user);if(kind==='guess'&&recent&&this.now()-recent.at<15000)return false;
  const cap=kind==='guess'?12:32;if(d.candidates.filter(c=>c.kind===kind).length>=cap){d.receipt={user,text:'本轮候选已满，请下一轮再问',at:this.now()};return false;}
  d.candidates.push({id:randomUUID(),user,text:value,kind,normalized,at:this.now()});d.roundUsers.push(user);
  if(kind==='guess'){d.guessTimes=d.guessTimes.filter(c=>this.now()-c.at<15000);d.guessTimes.push({user,at:this.now()});}
  d.receipt={user,text:'已进入候选，本轮精选后回答',at:this.now()};return true;
 }
 prune(){this.data.candidates=this.data.candidates.filter(c=>this.now()-c.at<45000);}
 tick(){
  const d=this.data;if(!this.active||d.pausedAt)return false;
  if(['playing','judging'].includes(d.phase)&&this.now()>=d.endsAt&&!d.pendingSpeech){this.reveal();return true;}
  if(d.phase!=='playing'||d.pendingSpeech)return false;
  if(d.hintCount<2&&(this.now()-d.startedAt>=(d.hintCount+1)*120000||d.emptyRounds>=2&&this.now()-d.startedAt>=45000)){this.hint();d.emptyRounds=0;return true;}
  this.prune();const waited=this.now()-(d.collectEndsAt-15000);
  if(this.now()<d.collectEndsAt&&!(waited>=5000&&d.candidates.length>=2)&&!d.candidates.some(c=>c.kind==='guess'))return false;
  if(!d.candidates.length){d.emptyRounds++;this.collect();return true;}
  d.emptyRounds=0;d.phase='judging';const candidates=[...d.candidates.filter(c=>c.kind==='guess'),...d.candidates.filter(c=>c.kind==='ask')];d.candidates=[];
  this.batch={revision:++this.revision,candidates,question:this.question,history:structuredClone(d.history)};return true;
 }
 takeBatch(){const b=this.batch;this.batch=null;return b;}
 apply(batch,result){
  const d=this.data;if(batch.revision!==this.revision||d.phase!=='judging'||d.pausedAt)return false;
  if(this.now()>=d.endsAt){this.reveal();return false;}
  d.answerQueue=result.answers.map(a=>({...batch.candidates.find(c=>c.id===a.id),...a}));
  if(!d.answerQueue.length){this.fail(batch);return false;}
  // Keep the current round's selected answers only, never an unbounded voice queue.
  d.phase='playing';this.showAnswer();return true;
 }
 fail(batch){if(batch.revision!==this.revision||this.data.phase!=='judging')return;this.data.phase='playing';this.data.receipt={text:'裁判暂时没连上，请稍后重新提问',at:this.now()};this.collect();}
 showAnswer(){const d=this.data,a=d.answerQueue.shift();if(!a)return;
  d.current={user:a.user,text:a.text,kind:a.kind,verdict:a.verdict,index:d.answerQueue.length?1:Math.min(2,(d.current?.round===d.round?d.current.index:0)+1),round:d.round};
  d.history.push({...a});d.history=d.history.slice(-60);
  for(const id of a.keys){if(!d.clues.includes(id)){d.clues.push(id);if(!d.contributors.includes(a.user))d.contributors.push(a.user);}}
  if(a.verdict==='已破案'){d.solver=a.user;d.answerQueue=[];}
  const suffix=a.verdict==='请拆分提问'?'请改成一个能用是或不是回答的问题。':a.verdict==='部分正确'?'方向接近了，试着补全原因。':'';
  this.cue('answer',`${a.user}${a.kind==='guess'?'猜':'问'}，${a.text}。${a.verdict}。${suffix}`);
 }
 hint(){const d=this.data;if(d.phase!=='playing'||d.pendingSpeech||d.pausedAt||d.hintCount>=this.question.hints.length)return false;
  d.hint=this.question.hints[d.hintCount++];this.cue('hint',`给大家一个提示：${d.hint}`);return true;
 }
 reveal(){const d=this.data;if(!['intro','playing','judging'].includes(d.phase)||d.pausedAt)return false;
  this.revision++;this.batch=null;d.phase='reveal';d.candidates=[];d.answerQueue=[];d.current=null;
  const praise=d.solver?`恭喜${d.solver}成功破案！`:d.contributors.length?'大家已经找到了重要线索，一起来看完整真相。':'一起来揭晓这道汤的真相。';
  this.cue('reveal',`${praise}${this.question.bottom}${d.contributors.length?`感谢${d.contributors.slice(0,3).join('、')}贡献线索。`:''}感谢大家一起推理！这段讲解结束后，我们继续下一题。`);return true;
 }
 replay(){if(!this.data.pendingSpeech)return false;this.cue(this.data.pendingSpeech.turtleCue.type,this.data.pendingSpeech.text);return true;}
 pause(){if(!this.active||this.data.pausedAt)return;this.data.pausedAt=this.now();this.revision++;this.batch=null;if(this.data.phase==='judging'){this.data.phase='playing';this.data.collectEndsAt=this.now()+15000;}}
 resume(){if(!this.data.pausedAt)return;this.shift(this.now()-this.data.pausedAt);delete this.data.pausedAt;this.replay();}
 exit(){this.revision++;this.batch=null;this.data={phase:'off',session:this.data.session,used:this.data.used};}
 view(){const d=this.data,q=this.question;return {phase:d.phase,session:d.session,gameId:d.gameId,sessionId:d.sessionId,paused:!!d.pausedAt,pausedAt:d.pausedAt,serverNow:this.now(),endsAt:d.endsAt,collectEndsAt:d.collectEndsAt,round:d.round,title:q?.title,surface:q?.surface,bottom:d.phase==='reveal'?q?.bottom:undefined,solver:d.solver,current:d.current,clues:(d.clues||[]).map(id=>q.keys.find(k=>k.id===id)?.text).filter(Boolean),contributors:d.contributors?.slice(0,3),hint:d.hintCount?d.hint:null,hintCount:d.hintCount||0,candidateCount:d.candidates?.length||0,receipt:d.receipt,pendingSpeech:d.pendingSpeech};}
}
