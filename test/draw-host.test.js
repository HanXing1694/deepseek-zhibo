import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DrawAndGuess} from '../draw-and-guess.js';
import {DrawHost,revealHostText} from '../draw-host.js';
import {gameHostCueValid} from '../public/game-host-cue.js';
import {SpeechQueue} from '../public/speech-queue.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('点赞只在隔场第三题揭晓时轻提醒，预热与揭晓文本一致',()=>{
 for(let session=1;session<=8;session++)for(let round=1;round<=6;round++){
  const g={session,round};const text=revealHostText(g,'雨伞');
  assert.equal(text.includes('点赞'),session%2===0&&round===3);
  assert.equal(text,revealHostText({...g,scores:[{user:'观众',score:2}]},'雨伞'));
  assert.doesNotMatch(text,/关注|礼物/);
 }
});
function fixture(){let now=100000;const game=new DrawAndGuess({now:()=>now,random:()=>.999}),host=new DrawHost(game.view());const take=()=>host.observe(game.view());return {game,host,take,advance:ms=>{now+=ms;game.tick();},now:()=>now};}
test('准备、开场、每轮字数和第25秒答案各播一次，提前不泄露答案',()=>{
 const {game,take,advance}=fixture();game.enter();assert.match(take()[0].text,/准备好啦/);assert.deepEqual(take(),[]);game.start();const opening=take();assert.equal(opening.length,1);assert.match(opening[0].text,/开始啦.*2个字/);assert.doesNotMatch(opening[0].text,/雨伞/);advance(24999);assert.deepEqual(take(),[]);advance(1);const reveal=take();assert.equal(reveal[0].gameCue.type,'reveal');assert.match(reveal[0].text,/答案是雨伞/);assert.deepEqual(take(),[]);advance(5000);assert.match(take()[0].text,/第2轮.*2个字/);advance(145000);assert.match(take()[0].text,/本场马上结算/);advance(5000);assert.deepEqual(take(),[]);
});
test('首位答对及时祝贺，后续合并且每5秒最多一次，重发答案不重复播报',()=>{
 const {game,take,advance}=fixture();game.enter();game.start();take();game.guess('桃子','雨伞');assert.match(take()[0].text,/桃子.*第一个答对.*两分/);assert.deepEqual(take(),[]);game.guess('阿星','雨伞');assert.deepEqual(take(),[]);game.guess('奶茶','雨伞');assert.deepEqual(take(),[]);advance(5000);const group=take();assert.equal(group.length,1);assert.match(group[0].text,/阿星、奶茶.*各加一分/);advance(1);assert.equal(game.guess('奶茶','雨伞'),false);assert.deepEqual(take(),[]);advance(20000);assert.equal(take()[0].gameCue.type,'reveal');assert.deepEqual(take(),[]);
});
test('重启不复播旧主持，退出、暂停、换轮和到期使旧语音失效',()=>{
 const {game,take,advance,now}=fixture();game.enter();const ready=take()[0];assert.equal(gameHostCueValid(ready,{running:true,drawGame:game.view()},now()),true);game.exit();game.enter();assert.equal(gameHostCueValid(ready,{running:true,drawGame:game.view()},now()),false);take();game.start();const start=take()[0];assert.deepEqual(new DrawHost(game.view()).observe(game.view()),[]);assert.equal(gameHostCueValid(start,{running:true,drawGame:game.view()},now()),true);game.pause();assert.equal(gameHostCueValid(start,{running:true,drawGame:game.view()},now()),false);advance(5000);game.resume();advance(25000);assert.equal(gameHostCueValid(start,{running:true,drawGame:game.view()},now()),false);const answer=take()[0];assert.equal(gameHostCueValid(answer,{running:true,drawGame:game.view()},now()),true);advance(5000);assert.equal(gameHostCueValid(answer,{running:true,drawGame:game.view()},now()),false);
});
test('拥挤语音队列丢弃过期答对播报，结算优先，退出后不复播',async()=>{
 const {game,take,advance,now}=fixture();game.enter();game.start();const played=[],finishes=[];const state=()=>({running:true,drawGame:game.view()});let paused=false;
 const queue=new SpeechQueue({play:r=>{played.push(r.id);return new Promise(resolve=>finishes.push(resolve));},now,isValid:r=>gameHostCueValid(r,state(),now()),paused:()=>paused});
 const start=take()[0];queue.enqueue(start);game.guess('桃子','雨伞');const winner=take()[0];queue.enqueue(winner);advance(25000);const answer=take()[0];queue.enqueue(answer);finishes.shift()();await tick();assert.deepEqual(played,[start.id,answer.id]);queue.enqueue({id:'settlement',kind:'game'});finishes.shift()();await tick();assert.equal(played.at(-1),'settlement');finishes.shift()();await tick();paused=true;advance(5000);const next=take()[0];queue.enqueue(next);game.exit();paused=false;await queue.drain();assert.equal(played.includes(next.id),false);
});
