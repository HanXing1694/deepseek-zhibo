import {randomUUID} from 'node:crypto';
const name=user=>[...String(user).replace(/[\r\n<>]/gu,'')].slice(0,12).join('');
// Keep reveal speech short enough for the five-second answer window.
// Session/round scheduling survives service restarts and avoids extra cue queues.
export const revealHostText=(game,answer)=>`答案是${answer}！${game.round===3&&game.session%2===0?'喜欢猜画的点点赞！':game.round===6?'本场马上结算啦！':'准备猜下一幅画！'}`;
// Observe authoritative game state. Late cues are discarded rather than replayed.
export class DrawHost{
 constructor(initial){this.scope=null;this.notice=null;this.pending=[];this.lastPraise=0;if(initial)this.seed(initial);}
 seed(game){this.scope=this.key(game);this.notice=game.notice?`${game.notice.at}:${game.notice.user}`:null;this.pending=[];}
 key(g){return `${g.gameId||''}:${g.sessionId||''}:${g.phase}:${g.round}:${g.revealed}`;}
 observe(g){
  if(!g||g.paused)return [];
  const now=g.serverNow,key=this.key(g),changed=key!==this.scope,cues=[];
  const add=(text,type,expiresAt)=>cues.push({id:randomUUID(),kind:'game-host',user:'小鲸',question:'你画我猜 · 现场主持',text,tokens:0,expiresAt,gameCue:{type,gameId:g.gameId,sessionId:g.sessionId,round:g.round,stage:g.phase==='ready'?'ready':g.revealed?'reveal':'drawing'}});
  if(changed){
   this.scope=key;this.pending=[];this.notice=null;this.lastPraise=0;
   if(g.phase==='ready')add('你画我猜准备好啦！等主播说开始画画，大家就可以发弹幕猜答案啦！','ready',now+20000);
   else if(g.phase==='drawing'&&g.revealed&&g.roundEndsAt>now)add(revealHostText(g,g.answer),'reveal',g.roundEndsAt);
   else if(g.phase==='drawing'&&g.roundEndsAt-now>20000)add(g.round===1?`开始啦！第${g.session}场你画我猜，第一轮是${g.answerLength}个字，快来猜！`:`第${g.round}轮来啦！答案是${g.answerLength}个字，大家继续猜！`,'round',g.roundEndsAt-5000);
  }
  if(g.phase==='drawing'&&!g.revealed&&g.roundEndsAt-now>6500){
   const signature=g.notice?`${g.notice.at}:${g.notice.user}`:null;
   if(signature&&signature!==this.notice){
    this.notice=signature;
    if(g.notice.points===2){add(`恭喜${name(g.notice.user)}，第一个答对，加两分！大家继续猜！`,'first',g.roundEndsAt-5000);this.lastPraise=now;}
    else if(!this.pending.includes(g.notice.user))this.pending.push(g.notice.user);
   }
   if(this.pending.length&&now-this.lastPraise>=5000){const users=this.pending.splice(0);add(`${users.slice(0,3).map(name).join('、')}${users.length>3?'等朋友':''}也答对啦，各加一分！`,'winner',g.roundEndsAt-5000);this.lastPraise=now;}
  }
  return cues;
 }
}
