import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engagement} from '../engagement.js';
import {deepseekReply,defaults} from '../lib.js';

test('关注邀请只在普通交流或第一轮主动聊天可选，提醒后冷却十分钟',()=>{
 const e=new Engagement(),now=1000000;
 assert.equal(e.context({},now).允许轻提醒关注,true);
 for(const kind of ['entryNotice','hostNotice','likeNotice','danceNotice','songNotice'])assert.equal(e.context({[kind]:true},now).允许轻提醒关注,false);
 e.spoken('喜欢这里的话，关注一下，下次好找到。',{},now);
 assert.equal(e.context({},now+599999).允许轻提醒关注,false);
 assert.equal(e.context({},now+600000).允许轻提醒关注,true);
});

test('无人接话逐步降低主动聊天频率，真实聊天恢复节奏，进场和测试消息不重置',()=>{
 const e=new Engagement();
 assert.equal(e.idleSeconds(15),45);
 e.spoken('不急不急，小鲸陪你慢慢待着。',{idleNotice:true,catchphraseNotice:true});assert.equal(e.idleSeconds(15),90);
 e.spoken('晚饭想吃米饭还是面？',{idleNotice:true});
 assert.equal(e.idleSeconds(15),180);assert.equal(e.context({idleNotice:true},1000000).允许轻提醒关注,false);
 e.activity({kind:'entry',source:'douyin'});e.activity({kind:'chat',source:'test'});assert.equal(e.idleSeconds(15),180);
 e.spoken('先听会歌。',{idleNotice:true});assert.equal(e.idleSeconds(15),180);
 e.spoken('肩膀放松一点。',{idleNotice:true});assert.equal(e.idleSeconds(15),180);
 e.activity({kind:'chat',source:'douyin'});assert.equal(e.idleSeconds(15),45);assert.equal(e.idleSeconds(15,true),90);
 e.spoken('先听歌。',{idleNotice:true,catchphraseNotice:true});assert.equal(e.idleSeconds(15,true),180);e.activity({kind:'chat',source:'douyin'});
 assert.equal(e.idleSeconds(120),120);
});

test('主动聊天带现场与互动节奏，关闭关注邀请时明确约束且不变成点歌操作',async()=>{
 const response=await deepseekReply({...defaults,apiKey:'fixture'}, {user:'电台',text:'开启话题',idleNotice:true,engagement:{允许轻提醒关注:false,连续主动发言次数:2},liveContext:{当前歌曲:{歌名:'夜曲'}}},[],async(url,options)=>{
  const body=JSON.parse(options.body),system=body.messages[0].content,data=JSON.parse(body.messages.at(-1).content);
  assert.match(system,/本轮不要邀请关注/);assert.match(system,/二选一/);assert.match(system,/不借低落情绪推关注/);
  assert.equal(data.互动节奏.连续主动发言次数,2);assert.equal(data.现场快照.当前歌曲.歌名,'夜曲');assert.equal(body.response_format,undefined);
  return {ok:true,json:async()=>({choices:[{message:{content:'夜曲放着，你们这会儿在忙还是在休息？'}}]})};
 });
 assert.equal(response.songQuery,undefined);assert.ok(response.text);
});

test('过长主动聊天完整改写，连续超长交由现场备用语处理，不截断句子',async()=>{
 let calls=0;
 const fetcher=async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:++calls===1?'这是一段过长的话。'.repeat(9):'听歌的时候，你喜欢热茶还是冰饮？'}}],usage:{total_tokens:5}})});
 const reply=await deepseekReply({...defaults,apiKey:'fixture'},{idleNotice:true,text:'开启话题'},[],fetcher);
 assert.equal(calls,2);assert.equal(reply.tokens,10);assert.equal(reply.text,'听歌的时候，你喜欢热茶还是冰饮？');
 await assert.rejects(deepseekReply({...defaults,apiKey:'fixture'},{idleNotice:true},[],async()=>({ok:true,json:async()=>({choices:[{message:{content:'很长的主动聊天。'.repeat(10)}}]})})),/40字以内/);
});
