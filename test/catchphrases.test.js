import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatchphraseBag,catchphrases,hasAudience} from '../catchphrases.js';
import {canIdle} from '../live-context.js';
import {defaults,validateSettings} from '../lib.js';
test('15句按轮随机播放，每轮无重复，轮次交界不重复',()=>{
 const bag=new CatchphraseBag(()=>0.5);
 let last;
 for(let round=0;round<5;round++){
  const phrases=Array.from({length:15},()=>bag.next());
  assert.notEqual(phrases[0],last);assert.equal(new Set(phrases).size,15);
  assert.deepEqual([...phrases].sort(),[...catchphrases].sort());last=phrases.at(-1);
 }
});
test('AI话题的观众依据排除测试及过期互动，在线零人数优先于历史弹幕',()=>{
 const now=100000,comments=[{source:'douyin',time:90000}];
 assert.equal(hasAudience({comments},now),true);
 assert.equal(hasAudience({comments:[{source:'test',time:99000}]},now),false);
 assert.equal(hasAudience({comments:[{source:'douyin',time:1000}]},now),false);
 assert.equal(hasAudience({comments,audience:{count:0,time:99000}},now),false);
 assert.equal(hasAudience({audience:{count:1,time:99000}},now),true);
 assert.equal(hasAudience({audience:{count:1,time:1000}},now),false);
 assert.equal(hasAudience({comments:[{source:'douyin',time:1000}]},now,300000),true);
 assert.equal(hasAudience({comments,audience:{count:0,time:99000}},now,300000),false);
 assert.equal(hasAudience({comments:[{source:'douyin',time:100001}]},now,300000),false);
});
test('语音结束后满配置间隔才接话，回复、礼物和排队工作优先',()=>{
 assert.equal(validateSettings({idleChatterSeconds:15},defaults).idleChatterSeconds,15);
 const input={state:{running:true,connection:'watching',songs:[],danceQueue:[],busy:false},config:{...defaults,idleChatterSeconds:15},queueLength:0,likes:0,pendingSongs:0,songBusy:false,lastActivity:1000,lastReply:2000,lastIdle:0,speechUntil:10000,now:24999};
 assert.equal(canIdle(input),false);assert.equal(canIdle({...input,now:25000}),true);
 for(const override of [{queueLength:1},{likes:1},{pendingSongs:1},{songBusy:true},{lastReply:24000},{lastActivity:24000},{state:{...input.state,effect:{}}},{state:{...input.state,busy:true}}])assert.equal(canIdle({...input,now:25000,...override}),false);
});
