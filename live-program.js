import {randomUUID} from 'node:crypto';
const hostKey=s=>String(s).normalize('NFKC').replace(/\s/gu,'').toLowerCase();
export function programCommand(user,text,host){if(!host||hostKey(user)!==hostKey(host))return null;return ({'开启轮播':'enable','停止轮播':'disable','再玩一场':'extra-game','听歌延长5分钟':'extra-music','下一场听歌':'next-music'})[String(text).trim()]||null;}
export class LiveProgram{
 constructor({saved,now=Date.now}={}){this.now=now;this.data=saved?.data||{enabled:false,phase:'manual'};this.probe=null;this.revision=0;}
 get active(){return this.data.enabled;}
 get blocking(){return this.active&&['to-music','to-draw','opening'].includes(this.data.phase);}
 enable(drawActive=false){if(this.active)return false;this.revision++;this.data={enabled:true,phase:drawActive?'draw':'music',cycleId:randomUUID(),gameTarget:5,completed:0,settled:[],musicElapsed:0,musicTarget:600000,extended:false,prewarned:false,nextMusic:false,pendingSpeech:null};this.probe=null;return true;}
 disable(){this.revision++;this.data.enabled=false;this.data.phase='manual';this.data.pendingSpeech=null;this.probe=null;}
 control(action){const d=this.data;if(action==='disable'){this.disable();return true;}if(!d.enabled)return false;if(action==='extra-game'&&d.phase==='draw'){d.gameTarget++;d.nextMusic=false;return true;}if(action==='next-music'&&d.phase==='draw'){d.nextMusic=true;return true;}if(action==='extra-music'&&d.phase==='music'){d.musicTarget+=300000;d.prewarned=false;if(d.pendingSpeech?.programCue.type==='warning')d.pendingSpeech=null;return true;}return false;}
 settle(id){const d=this.data;if(!d.enabled||d.phase!=='draw'||d.settled.includes(id))return false;d.settled.push(id);d.settled=d.settled.slice(-100);d.completed++;return true;}
 get wantsMusic(){const d=this.data;return d.enabled&&d.phase==='draw'&&(d.completed>=d.gameTarget||d.nextMusic);}
 toMusic(){if(!this.wantsMusic)return false;this.data.phase='to-music';this.data.pendingSpeech=null;this.probe=null;return true;}
 enterMusic(){if(!this.active||this.data.phase!=='to-music')return false;Object.assign(this.data,{phase:'music',musicElapsed:0,musicTarget:600000,extended:false,prewarned:false,pendingSpeech:null});this.probe=null;return true;}
 observeMusic({track,position,playing,running,effect=false,waiting=0}){
  const d=this.data,now=this.now(),previous=this.probe;
  this.probe={track,position,now,eligible:d.enabled&&d.phase==='music'&&running&&playing&&!effect};
  if(!this.probe.eligible)return false;
  if(previous?.eligible&&track===previous.track&&now-previous.now<10000){const amount=Math.max(0,Math.min((position-previous.position)*1000,now-previous.now+500));d.musicElapsed+=amount;}
  if(d.musicElapsed>=d.musicTarget&&!d.extended&&waiting>5){d.musicTarget+=300000;d.extended=true;d.prewarned=false;if(d.pendingSpeech?.programCue.type==='warning')d.pendingSpeech=null;d.notice='点歌较多，本轮音乐时间延长5分钟';}
  if(d.musicTarget-d.musicElapsed<=30000&&!d.prewarned&&!d.pendingSpeech){d.prewarned=true;this.cue('warning','这段音乐时间快结束啦，接下来继续你画我猜。今日积分继续累计，刚来的朋友也能直接参加！');}
  return true;
 }
 get due(){return this.active&&this.data.phase==='music'&&this.data.musicElapsed>=this.data.musicTarget;}
 boundary(){if(!this.due)return false;this.data.phase='to-draw';this.data.pendingSpeech=null;this.probe=null;this.revision++;return true;}
 opening(){if(!this.active||this.data.phase!=='to-draw')return false;this.data.phase='opening';this.cue('opening','新一组你画我猜准备好啦！连续玩五场，今日积分接着累积。答案公布前首位答对两分，其余一分。想看自己的成绩，发我的战绩；想看排名，发今日榜；不了解规则，发怎么玩。游戏时也能发送点歌加歌名，游戏中按队列播放。一起开始！');return true;}
 cue(type,text){this.data.pendingSpeech={id:randomUUID(),kind:'program',user:'小鲸',question:'猜题与音乐 · 节目预告',text,tokens:0,programCue:{cycleId:this.data.cycleId,type}};}
 ended(id){const d=this.data,cue=d.pendingSpeech;if(!d.enabled||cue?.id!==id)return null;d.pendingSpeech=null;if(cue.programCue.type==='opening'){Object.assign(d,{phase:'draw',cycleId:randomUUID(),completed:0,gameTarget:5,settled:[],nextMusic:false});return 'start-draw';}return 'warning';}
 replay(){const cue=this.data.pendingSpeech;if(!cue)return false;this.cue(cue.programCue.type,cue.text);return true;}
 pause(){this.probe=null;}
 view(){const d=this.data;return {...d,serverNow:this.now(),remainingMs:Math.max(0,(d.musicTarget||600000)-(d.musicElapsed||0)),gameNumber:d.phase==='draw'?Math.min(d.gameTarget,Math.max(1,d.completed+1)):null};}
 snapshot(){return {data:structuredClone(this.data)};}
}
