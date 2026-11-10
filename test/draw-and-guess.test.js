import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DrawAndGuess,drawCommand} from '../draw-and-guess.js';

function fixture(){let now=1000000;const game=new DrawAndGuess({now:()=>now,random:()=>.999});game.enter();game.start();return {game,advance:ms=>{now+=ms;game.tick();},now:()=>now};}
test('关注与朋友分享邀请错开，每四场各一次，刷新和恢复不改变节奏',()=>{
 const {game,advance,now}=fixture();
 for(let session=1;session<=9;session++){
  advance(180000);const text=game.celebration();
  assert.equal(text.includes('关注'),session%4===1);
  assert.equal(text.includes('分享'),session%4===3);
  if(session%4===3)assert.match(text,/朋友.*分享|分享.*朋友/);
  assert.doesNotMatch(text,/礼物|上榜|榜首|第一名/);
  const restored=new DrawAndGuess({now,saved:JSON.parse(JSON.stringify(game.snapshot()))});
  assert.equal(restored.celebration(),text);
  game.ended(game.view().settlementId);
 }
});
test('只有主播的完整口令可触发，重复开场不重置比赛',()=>{
 assert.equal(drawCommand('Han_Skr','你画我猜','Han_Skr'),'enter');assert.equal(drawCommand('观众','你画我猜','Han_Skr'),null);assert.equal(drawCommand('Han_Skr','我想你画我猜','Han_Skr'),null);assert.equal(drawCommand('Han_Skr','返回听歌','Han_Skr'),'exit');assert.equal(drawCommand('Han_Skr','开始画画',''),null);
 const {game}=fixture(),id=game.view().sessionId;assert.equal(game.start(),false);assert.equal(game.enter(),false);assert.equal(game.view().sessionId,id);
});
test('首位两分、后续一分、同人每轮只计一次，轮次截止后不接受旧答案',()=>{
 const {game,advance}=fixture();assert.equal(game.guess('桃子','雨伞'),true);advance(1);assert.equal(game.guess('阿星',' 伞！'),true);assert.equal(game.guess('桃子','雨傘'),false);assert.equal(game.guess('奶茶','答案是雨伞'),false);assert.deepEqual(game.ranking().map(s=>[s.user,s.score]),[['桃子',2],['阿星',1]]);
 advance(29999);assert.equal(game.view().round,2);assert.equal(game.guess('奶茶','雨伞'),false);assert.equal(game.guess('阿星','蘋果'),true);assert.equal(game.ranking()[0].user,'阿星');assert.equal(game.view().lastAnswer,'雨伞');
});
test('三分钟恰好六轮，结算只接受本场播放完成，下一场清零并避免上一场题目',()=>{
 const {game,advance}=fixture();const deck=[...game.data.deck];game.guess('桃子','雨伞');for(let i=1;i<6;i++){advance(30000);assert.equal(game.view().round,i+1);assert.equal(game.view().phase,'drawing');}advance(30000);assert.equal(game.view().phase,'settlement');assert.match(game.celebration(),/第一名桃子/);assert.match(game.celebration(),/感谢/);assert.equal(game.ended('wrong'),false);advance(600000);assert.equal(game.view().phase,'settlement');const id=game.view().settlementId;assert.equal(game.ended(id),true);assert.equal(game.ended(id),false);assert.equal(game.view().session,2);assert.deepEqual(game.ranking(),[]);assert.ok(game.data.deck.every(i=>!deck.includes(i)));
});
test('暂停与恢复、刷新和进程恢复保留本轮积分及绘画进度，退出取消自动开场',()=>{
 const {game,advance,now}=fixture();game.guess('桃子','雨伞');advance(10000);game.pause();advance(120000);assert.equal(game.view().round,1);assert.equal(game.guess('观众','雨伞'),false);game.resume();assert.equal(game.view().roundEndsAt-now(),20000);
 const saved=JSON.parse(JSON.stringify(game.snapshot()));advance(60000);const restored=new DrawAndGuess({now,random:()=>.999,saved});assert.equal(restored.view().round,1);assert.equal(restored.view().roundEndsAt-now(),20000);assert.equal(restored.ranking()[0].score,2);assert.equal(restored.guess('桃子','雨伞'),false);assert.equal(JSON.stringify(restored.view()).includes('雨伞'),false);assert.equal(restored.view().deck,undefined);restored.exit();assert.equal(restored.ended('anything'),false);assert.equal(restored.active,false);
});
test('无人答对与不足三人时，播报不会编造获奖者',()=>{
 const {game,advance}=fixture();advance(180000);assert.match(game.celebration(),/没有人得分/);assert.doesNotMatch(game.celebration(),/第一名/);game.ended(game.view().settlementId);game.data.scores=[{user:'唯一',score:2,reachedAt:1}];advance(180000);assert.match(game.celebration(),/第一名唯一/);assert.doesNotMatch(game.celebration(),/第二名|第三名/);
});
test('第25秒公布后仍得1分，每人每题一次，第30秒旧答案失效',()=>{
 const {game,advance}=fixture();assert.equal(game.view().answerLength,2);assert.equal(game.view().answer,undefined);assert.equal(game.view().revealed,false);
 advance(24999);assert.equal(game.view().answer,undefined);assert.equal(game.guess('抢答者','雨伞'),true);advance(1);assert.equal(game.view().round,1);assert.equal(game.view().revealed,true);assert.equal(game.view().answer,'雨伞');assert.equal(game.guess('看到答案者','雨伞'),true);assert.equal(game.guess('同义词者','伞'),true);assert.equal(game.guess('抢答者','雨伞'),false);assert.equal(game.guess('看到答案者','雨傘'),false);assert.deepEqual(game.ranking().map(s=>s.score),[2,1,1]);
 advance(4999);assert.equal(game.view().answer,'雨伞');assert.equal(game.guess('最后一刻','雨伞'),true);advance(1);assert.equal(game.view().round,2);assert.equal(game.view().answer,undefined);assert.equal(game.view().revealed,false);assert.equal(game.guess('迟到者','雨伞'),false);assert.equal(game.guess('新一轮','苹果'),true);
});
test('公布后首位也只得1分，末轮结算后旧答案不计分',()=>{
 const {game,advance}=fixture();advance(25000);assert.equal(game.guess('公布后首位','雨伞'),true);assert.equal(game.ranking()[0].score,1);
 advance(150000);const answer=game.answerForHost();assert.equal(game.guess('末轮公布后',answer),true);assert.equal(game.data.notice.points,1);advance(4999);assert.equal(game.guess('末轮最后一刻',answer),true);advance(1);assert.equal(game.view().phase,'settlement');assert.equal(game.guess('结算后',answer),false);
});
test('暂停及进程恢复沿用公布答案阶段，最后一轮同样预留5秒展示答案',()=>{
 const {game,advance,now}=fixture();game.data.deck[0]=6;assert.equal(game.view().answerLength,3);advance(24999);game.pause();advance(10000);assert.equal(game.view().revealed,false);game.resume();advance(1);assert.equal(game.view().answer,'自行车');
 const saved=JSON.parse(JSON.stringify(game.snapshot()));advance(60000);const restored=new DrawAndGuess({now,saved});assert.equal(restored.view().answer,'自行车');assert.equal(restored.guess('恢复后','自行车'),true);assert.equal(restored.ranking()[0].score,1);assert.equal(restored.view().roundEndsAt-now(),5000);
 const final=fixture();final.advance(175000);assert.equal(final.game.view().round,6);assert.equal(final.game.view().revealed,true);assert.equal(final.game.view().phase,'drawing');final.advance(5000);assert.equal(final.game.view().phase,'settlement');
});
