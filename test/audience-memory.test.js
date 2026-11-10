import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudienceMemory,liveContext,forgetMemory} from '../live-context.js';
import {deepseekReply,defaults} from '../lib.js';
const event=(text,user='小鱼')=>({source:'douyin',kind:'chat',user,text});
test('招呼不挤掉话题，去重，隔离测试来源，旧记录可恢复',()=>{
 const m=new AudienceMemory([],1000);
 m.remember(event('喜欢听动漫歌曲'),null,1000);
 for(let i=0;i<12;i++)m.remember(event('你好'),null,1001+i);
 m.remember(event('喜欢听动漫歌曲'),null,1100);
 m.remember({...event('虚构偏好'),source:'test'},null,1200);
 const restored=new AudienceMemory(m.serialize(),1300);
 assert.deepEqual(restored.get('小鱼',1300).最近聊过,['喜欢听动漫歌曲']);
 assert.equal(restored.context({...event('你记得我吗'),source:'test'},1300),null);
 assert.equal(restored.context(event('你好','别人'),1300),null);
});
test('回归才主动回忆，排队的旧快照不能绕过30分钟间隔，主动询问可回答',()=>{
 const m=new AudienceMemory([],1000);m.remember(event('喜欢夜曲'),null,1000);
 assert.equal(m.context(event('你好'),2000).允许主动提起,false);
 const now=31*60000, captured=m.context(event('你好'),now);
 assert.equal(captured.允许主动提起,true);
 m.remember(event('你好'),null,now);m.recalled('小鱼',now);
 assert.equal(m.replyContext({...event('你好'),audienceMemory:captured},now+1000).允许主动提起,false);
 assert.equal(m.context(event('还记得我吗'),now+2000).允许主动提起,true);
 const restored=new AudienceMemory(m.serialize(),now+3000);
 assert.equal(restored.replyContext({...event('你好'),audienceMemory:captured},now+3000).允许主动提起,false);
});
test('纠正优先，忘记命令删除本人记录，不影响别人',()=>{
 const m=new AudienceMemory([],1000);m.remember(event('喜欢摇滚'),null,1000);
 m.remember(event('喜欢民谣','别人'),null,1000);
 assert.equal(m.context(event('不是摇滚，是动漫'),2000),null);
 m.remember(event('不是摇滚，是动漫'),null,2000);
 assert.deepEqual(m.get('小鱼',2001).最近聊过,['不是摇滚，是动漫']);
 m.remember(event('忘记我'),null,3000);
 assert.equal(m.get('小鱼',3001),null);assert.ok(m.get('别人',3001));
 assert.equal(forgetMemory('请忘记我'),true);assert.equal(forgetMemory('歌词里有忘记我'),false);
});
test('持续运行也清理过期记录，不复活旧话题',()=>{
 const m=new AudienceMemory([],1000);m.remember(event('旧话题'),null,1000);
 m.remember(event('新话题'),null,31*86400000);
 assert.deepEqual(m.get('小鱼',31*86400000+1).最近聊过,['新话题']);
});
test('真实点歌独立保留，记忆快照不包含当前消息',()=>{
 const m=new AudienceMemory([],1000);
 m.remember(event('点歌 夜曲'),{title:'夜曲',artist:'周杰伦'},1000);
 const captured=m.context(event('今天想聊动漫'),31*60000);
 m.remember(event('今天想聊动漫'),null,31*60000);
 assert.deepEqual(captured.最近聊过,[]);
 assert.equal(captured.最近点歌[0].title,'夜曲');
 assert.deepEqual(m.get('小鱼',31*60000).最近聊过,['今天想聊动漫']);
});
test('模型收到同一观众事实与回忆节奏，提示不猜最爱、不编时间、不替人点歌',async()=>{
 const m=new AudienceMemory([],1000);m.remember(event('喜欢动漫歌曲'),null,1000);
 const e=event('还记得我吗');
 await deepseekReply({...defaults,apiKey:'fixture'}, {...e,liveContext:liveContext({songs:[]},e.user,defaults,m.context(e,2000),2000)},[],async(_url,options)=>{
  const body=JSON.parse(options.body),prompt=body.messages[0].content;
  assert.match(prompt,/常客相处/);assert.match(prompt,/不等于最爱/);assert.match(prompt,/没有逐条时间依据/);assert.match(prompt,/不因记忆擅自点歌/);
  const data=JSON.parse(body.messages.at(-1).content);
  assert.deepEqual(data.现场快照.常客记录.最近聊过,['喜欢动漫歌曲']);
  assert.equal(data.现场快照.常客记录.观众主动询问记忆,true);
  return {ok:true,json:async()=>({choices:[{message:{content:'记得之前你聊过动漫歌曲。'}}]})};
 });
});
test('无资料被问记忆时直接坦诚说明，不让模型编造旧对话，也不吞掉明确点歌',async()=>{
 const config={...defaults,apiKey:'fixture'};
 const context=liveContext({songs:[]},'新人',config,null);
 const reply=await deepseekReply(config,{text:'还记得我吗',liveContext:context},[],async()=>{throw new Error('Should not call the model');});
 assert.match(reply.text,/暂时没记清/);assert.equal(reply.tokens,0);
 let called=false;
 await deepseekReply(config,{text:'还记得我吗，点歌 夜曲',interpretIntent:true,liveContext:context},[],async()=>{
  called=true;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({intent:'song',query:'夜曲',reply:''})}}]})};
 });assert.equal(called,true);
});
