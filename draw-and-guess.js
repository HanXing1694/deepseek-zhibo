import {randomUUID} from 'node:crypto';
import {extraQuestions} from './draw-questions-extra.js';
import {animalQuestions} from './draw-questions-animals.js';
import {foodQuestions} from './draw-questions-food.js';
import {objectQuestions} from './draw-questions-objects.js';
import {playQuestions} from './draw-questions-play.js';
import {dailyQuestions} from './draw-questions-daily.js';
import {homeQuestions} from './draw-questions-home.js';
import {outdoorQuestions} from './draw-questions-outdoors.js';
import {wildlifeQuestions} from './draw-questions-wildlife.js';
import {treatQuestions} from './draw-questions-treats.js';
import {toolQuestions} from './draw-questions-tools.js';
import {adventureQuestions} from './draw-questions-adventure.js';
import {expansionQuestions} from './draw-questions-expansion.js';

// Coordinates use a 600 × 480 board. Answers stay on the server.
const oval=(x,y,rx,ry)=>Array.from({length:49},(_,i)=>[x+rx*Math.cos(i*Math.PI/24),y+ry*Math.sin(i*Math.PI/24)]);
const line=(...points)=>points;
export const questions=[
 ['雨伞',['伞','雨傘'],[line([100,230],[115,185],[150,140],[210,105],[300,90],[390,105],[450,140],[485,185],[500,230]),line([100,230],[145,210],[190,230],[240,210],[300,230],[360,210],[410,230],[455,210],[500,230]),line([300,90],[300,360],[290,385],[265,395],[245,385],[240,365]),line([300,90],[250,120],[220,175],[190,230]),line([300,90],[350,120],[380,175],[410,230])]],
 ['苹果',['蘋果'],[line([300,145],[245,115],[190,125],[155,175],[150,240],[175,315],[220,365],[265,375],[300,360],[335,375],[380,365],[425,315],[450,240],[445,175],[410,125],[355,115],[300,145]),line([300,145],[305,90],[330,60]),line([310,100],[335,65],[385,65],[360,95],[310,100])]],
 ['小猫',['猫','猫咪','小貓','貓'],[line([165,195],[155,90],[235,140],[300,130],[365,140],[445,90],[435,195]),line([165,195],[155,265],[190,325],[250,355],[350,355],[410,325],[445,265],[435,195]),oval(235,235,12,18),oval(365,235,12,18),line([285,270],[315,270],[300,285],[285,270]),line([300,285],[285,305],[270,300]),line([300,285],[315,305],[330,300]),line([225,280],[120,260]),line([225,300],[115,310]),line([375,280],[480,260]),line([375,300],[485,310])]],
 ['房子',['小屋','房屋','小房子'],[line([100,220],[300,65],[500,220],[100,220]),line([145,220],[145,400],[455,400],[455,220]),line([265,400],[265,285],[335,285],[335,400]),line([180,260],[230,260],[230,320],[180,320],[180,260]),line([365,260],[415,260],[415,320],[365,320],[365,260]),line([390,130],[390,80],[430,80],[430,160])]],
 ['太阳',['太陽'],[oval(300,240,100,100),...Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return line([300+130*Math.cos(a),240+130*Math.sin(a)],[300+175*Math.cos(a),240+175*Math.sin(a)]);}),oval(270,225,5,8),oval(330,225,5,8),line([270,265],[285,278],[300,283],[315,278],[330,265])]],
 ['小鱼',['鱼','魚','小魚'],[line([145,240],[200,170],[280,145],[360,170],[410,220],[490,160],[490,320],[410,260],[360,310],[280,335],[200,310],[145,240]),oval(215,225,12,12),line([270,150],[300,95],[345,165]),line([270,330],[310,380],[345,315]),line([280,190],[300,215],[280,240],[300,265],[280,290])]],
 ['自行车',['单车','腳踏車','腳踏车','自行車','单车'],[oval(160,310,95,95),oval(440,310,95,95),line([160,310],[245,170],[320,310],[160,310],[365,170],[440,310]),line([320,310],[290,160]),line([250,160],[315,160]),line([365,170],[355,125],[395,105]),oval(320,310,14,14)]],
 ['冰淇淋',['冰激凌','雪糕','甜筒'],[line([210,245],[300,425],[390,245],[210,245]),line([230,280],[345,335]),line([250,325],[325,365]),line([370,280],[255,335]),line([350,325],[280,380]),line([210,245],[170,225],[165,195],[180,170],[215,165],[210,125],[235,90],[280,85],[300,100],[320,85],[365,90],[390,125],[385,165],[420,170],[435,195],[430,225],[390,245])]],
 ['胡萝卜',['紅蘿蔔','红萝卜','胡蘿蔔'],[line([240,150],[300,425],[390,175],[370,135],[320,115],[270,120],[240,150]),line([290,120],[260,60],[290,75],[315,115]),line([315,115],[325,45],[345,65],[340,120]),line([340,120],[385,65],[400,90],[360,135]),line([260,200],[300,215]),line([350,235],[315,245]),line([285,310],[310,320])]],
 ['火箭',['火箭飞船','火箭飛船'],[line([230,300],[225,180],[250,100],[300,45],[350,100],[375,180],[370,300],[230,300]),oval(300,175,40,40),line([230,240],[170,300],[160,365],[230,320]),line([370,240],[430,300],[440,365],[370,320]),line([260,325],[265,370],[285,350],[300,430],[320,350],[335,370],[340,325])]],
 ['西瓜',[],[line([110,190],[490,190],[480,260],[440,330],[370,375],[300,390],[230,375],[160,330],[120,260],[110,190]),line([140,215],[460,215],[445,280],[405,325],[350,350],[300,360],[250,350],[195,325],[155,280],[140,215]),oval(220,260,5,10),oval(300,290,5,10),oval(380,260,5,10),oval(260,330,5,10),oval(340,330,5,10)]],
 ['花朵',['花','小花','鲜花','鮮花'],[oval(300,180,38,38),...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return oval(300+65*Math.cos(a),180+65*Math.sin(a),35,35);}),line([300,255],[300,425]),line([300,350],[230,280],[200,280],[215,325],[300,350]),line([300,380],[370,305],[400,300],[385,350],[300,380])]],
 ['蝴蝶',[],[oval(300,240,18,100),line([282,210],[220,90],[150,80],[110,120],[120,200],[200,260],[135,300],[135,360],[180,390],[250,350],[282,265]),line([318,210],[380,90],[450,80],[490,120],[480,200],[400,260],[465,300],[465,360],[420,390],[350,350],[318,265]),line([290,145],[265,105]),line([310,145],[335,105])]],
 ['茶杯',['杯子','水杯','咖啡杯'],[line([150,170],[175,355],[205,385],[365,385],[395,355],[420,170],[150,170]),oval(285,170,135,25),line([415,205],[475,205],[495,230],[495,280],[470,315],[402,315]),line([230,115],[215,90],[235,65],[225,40]),line([300,115],[285,90],[305,65],[295,40]),line([120,410],[450,410])]],
 ['小树',['树','大树','樹','小樹'],[line([265,330],[265,430],[335,430],[335,330]),line([265,340],[190,350],[145,320],[125,270],[145,220],[180,205],[180,150],[220,115],[260,115],[285,70],[330,65],[375,100],[390,150],[435,170],[465,220],[460,280],[425,325],[375,340],[335,340]),line([300,370],[300,250]),line([300,300],[245,255]),line([300,275],[350,220])]],
 ['月亮',['月牙'],[line([360,60],[300,70],[235,105],[190,165],[170,235],[180,305],[220,365],[280,400],[350,410],[410,390],[445,355],[385,370],[330,350],[285,310],[260,250],[260,185],[285,125],[320,85],[360,60])]],
 ['蘑菇',['磨菇'],[line([110,240],[130,175],[185,120],[250,90],[350,90],[415,120],[470,175],[490,240],[110,240]),line([255,240],[240,395],[265,420],[335,420],[360,395],[345,240]),oval(205,180,24,18),oval(315,140,25,18),oval(405,195,22,18)]],
 ['气球',['氣球'],[oval(300,170,110,130),line([290,300],[275,325],[325,325],[310,300]),line([300,325],[280,355],[315,390],[290,435]),line([245,105],[230,130],[225,155])]],
 ...extraQuestions,
 ...animalQuestions,...foodQuestions,...objectQuestions,...playQuestions,
 ...dailyQuestions,
 ...homeQuestions,...outdoorQuestions,
 ...wildlifeQuestions,...treatQuestions,...toolQuestions,...adventureQuestions,
 ...expansionQuestions,
];
const clean=s=>String(s).normalize('NFKC').replace(/[\s，。！？、,.!?~～]/gu,'').toLowerCase();
export class DrawAndGuess{
 constructor({now=Date.now,random=Math.random,saved}={}){this.now=now;this.random=random;this.data=saved?.data||{phase:'off',scores:[],session:0};this.recent=saved?.recent||[];this.used=[...new Set(saved?.used??[...this.recent,...(this.data.deck||[])])].filter(i=>Number.isInteger(i)&&i>=0&&i<questions.length);if(saved?.savedAt&&this.data.phase==='drawing'&&!this.data.pausedAt){this.data.startedAt+=Math.max(0,now()-saved.savedAt);}}
 get active(){return this.data.phase!=='off';}
 enter(){if(this.active)return false;this.data={phase:'ready',gameId:randomUUID(),scores:[],session:0};return true;}
 start(){
  if(!['ready','settlement'].includes(this.data.phase))return false;
  const used=new Set(this.used),deck=[];
  const shuffledPool=()=>{
   const pool=questions.map((_,i)=>i).filter(i=>!used.has(i));
   for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
   return pool;
  };
  let pool=shuffledPool();
  while(deck.length<6){
   if(!pool.length){used.clear();pool=shuffledPool();}
   // At a cycle boundary, defer the previous game's questions and this game's
   // already selected questions. They remain unused for later games.
   const index=pool.findIndex(i=>!this.recent.includes(i)&&!deck.includes(i));
   const [id]=pool.splice(index,1);deck.push(id);used.add(id);
  }
  this.used=[...used];this.recent=deck;
  this.data={...this.data,phase:'drawing',session:this.data.session+1,sessionId:randomUUID(),startedAt:this.now(),deck,round:0,scores:[],winners:[],notice:null,lastAnswer:null,settlementId:null};return true;
 }
 tick(){const d=this.data;if(d.phase!=='drawing'||d.pausedAt)return false;const round=Math.min(6,Math.floor((this.now()-d.startedAt)/30000));if(round===d.round)return false;d.lastAnswer=questions[d.deck[d.round]][0];d.round=round;d.winners=[];d.notice=null;if(round===6){d.phase='settlement';d.settlementId=randomUUID();}return true;}
 guess(user,text){this.tick();const d=this.data,now=this.now();if(d.phase!=='drawing'||d.pausedAt||now>=d.startedAt+(d.round+1)*30000||d.winners.includes(user))return false;const q=questions[d.deck[d.round]];if(![q[0],...q[1]].some(a=>clean(a)===clean(text)))return false;const points=!d.winners.length&&now<d.startedAt+d.round*30000+25000?2:1;d.winners.push(user);let row=d.scores.find(s=>s.user===user);if(!row){row={user,score:0,reachedAt:0};d.scores.push(row);}row.score+=points;row.reachedAt=now;d.notice={user,points,at:now};return true;}
 ranking(){return [...this.data.scores].sort((a,b)=>b.score-a.score||a.reachedAt-b.reachedAt);}
 answerForHost(){const d=this.data;return d.phase==='drawing'?questions[d.deck[d.round]][0]:null;}
 celebration(){
  const top=this.ranking().slice(0,3),session=this.data.session;
  const thanks=top.length?`本场你画我猜结束啦！${top.map((s,i)=>`恭喜第${['一','二','三'][i]}名${s.user}，获得${s.score}分`).join('；')}！感谢大家的热情参与！`:'本场你画我猜结束啦！这场还没有人得分，感谢大家参与！';
  // Space follow/share invitations two games apart; each repeats every four games.
  const chat=session%4===1
   ? ['喜欢一起猜画的朋友，可以点个关注，下次开播好找到这里！','今天玩得开心的话，可以点个关注，下次继续来抢第一！'][Math.floor(session/4)%2]
   : session%4===3
    ? ['你身边有没有一眼就能猜中的朋友？可以把直播间分享给他，下一场一起比比谁猜得快！','想到哪位爱猜谜的朋友了？把直播间分享给他，有空一起来猜，看看你们谁更有默契！'][Math.floor(session/4)%2]
    : !top.length?'刚来的朋友也可以直接发弹幕猜答案！':['这场谁连续猜中了？弹幕告诉我！','刚来的朋友也可以直接发弹幕猜答案！','下一场谁来挑战榜首？弹幕告诉我！'][session%3];
  return `${thanks}${chat}下一场马上开始，继续一起猜吧！`;
 }
 ended(id){if(this.data.phase!=='settlement'||this.data.settlementId!==id)return false;return this.start();}
 exit(){this.data={phase:'off',scores:[],session:0};}
 pause(){if(this.active&&!this.data.pausedAt)this.data.pausedAt=this.now();}
 resume(){if(this.data.pausedAt){if(this.data.phase==='drawing')this.data.startedAt+=this.now()-this.data.pausedAt;delete this.data.pausedAt;}}
 snapshot(){return {data:this.data,recent:this.recent,used:this.used,savedAt:this.now()};}
 view(){const d=this.data,q=d.phase==='drawing'?questions[d.deck[d.round]]:null,revealed=!!q&&(d.pausedAt||this.now())>=d.startedAt+d.round*30000+25000;return {phase:d.phase,gameId:d.gameId,paused:!!d.pausedAt,pausedAt:d.pausedAt,session:d.session,sessionId:d.sessionId,round:Math.min(6,(d.round||0)+1),roundEndsAt:d.phase==='drawing'?d.startedAt+(d.round+1)*30000:null,endsAt:d.phase==='drawing'?d.startedAt+180000:null,serverNow:this.now(),answerLength:q?[...q[0]].length:null,revealed,answer:revealed?q[0]:undefined,strokes:q?.[2]||[],scores:this.ranking().slice(0,8),notice:d.notice,lastAnswer:d.lastAnswer,settlementId:d.settlementId,celebration:d.phase==='settlement'?this.celebration():null};}
}
export function drawCommand(user,text,host){if(!host||clean(user)!==clean(host))return null;return ({'你画我猜':'enter','開始畫畫':'start','开始画画':'start','返回听歌':'exit','返回聽歌':'exit'})[String(text).trim()]||null;}
