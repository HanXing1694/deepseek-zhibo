import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudienceMemory,liveContext,canIdle,needsThinking} from '../live-context.js';
import {deepseekReply,defaults,validateSettings} from '../lib.js';
const state={running:true,connection:'receiving',busy:false,songs:[],danceQueue:[],currentSong:{title:'夜曲',artist:'周杰伦',user:'小鱼',status:'正在播放'}};
const config={...defaults,idleChatterSeconds:120,apiKey:'test'};
const result=content=>({ok:true,json:async()=>({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)},finish_reason:'stop'}],usage:{total_tokens:17}})});
test('现场包含当前曲目、队列外的本人完整位置、最近真实礼物，不带密钥或缓存路径',()=>{
 const songs=Array.from({length:12},(_,i)=>({title:'歌'+i,artist:'歌手',user:i===10?'我':'别人'}));
 const context=liveContext({...state,songs,lastGift:{user:'阿鱼',name:'玫瑰',count:2,time:900}},'我',config,null,1000);
 assert.equal(context.当前歌曲.歌名,'夜曲');assert.equal(context.队列前几首.length,6);assert.equal(context.这位观众的排队[0].位置,11);
 assert.equal(context.最近礼物[0].数量,2);assert.ok(!JSON.stringify(context).includes('test'));
 assert.equal(liveContext({...state,lastGift:{time:0}},'我',config,null,700000).最近礼物.length,0);
});
test('常客只记录真实来源，按昵称隔离、限定大小、可持久恢复并过期',()=>{
 const m=new AudienceMemory([],1000);
 m.remember({user:'甲',text:'喜欢夜曲',source:'test'},null,1000);assert.equal(m.get('甲',1001),null);
 m.remember({user:'甲',text:'喜欢夜曲',source:'douyin'},null,1000);
 m.remember({user:'甲',source:'douyin'},{title:'夜曲',artist:'周杰伦'},1001);
 assert.equal(m.get('乙',1002),null);assert.deepEqual(m.get('甲',1002).最近聊过,['喜欢夜曲']);
 const restored=new AudienceMemory(JSON.parse(JSON.stringify(m.serialize())),1003);assert.equal(restored.get('甲',1004).最近点歌[0].title,'夜曲');
 assert.equal(restored.get('甲',31*86400000),null);
 for(let i=0;i<510;i++)m.remember({user:'鱼'+i,source:'douyin',text:'嗨'},null,2000);
 assert.equal(m.serialize().length,500);
});
test('自然点歌只返回候选，不口播成功；普通聊天一次请求同时返回回复',async()=>{
 for(const [text,query] of [['帮我放晴天','晴天'],['来一首周杰伦的晴天','周杰伦 晴天'],['有没有周杰伦','周杰伦']]){
  const reply=await deepseekReply(config,{user:'我',text,interpretIntent:true,liveContext:liveContext(state,'我',config)},[],async(url,options)=>{
   const payload=JSON.parse(options.body);assert.equal(payload.response_format.type,'json_object');assert.equal(payload.thinking.type,'enabled');
   assert.equal(JSON.parse(payload.messages.at(-1).content).现场快照.当前歌曲.歌名,'夜曲');
   assert.match(payload.messages[0].content,/不要放晴天/);return result({intent:'song',query,reply:''});
  });assert.equal(reply.songQuery,query);assert.equal(reply.text,'');assert.equal(reply.tokens,17);
 }
 let calls=0;const reply=await deepseekReply(config,{text:'你好',interpretIntent:true},[],async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).thinking.type,'disabled');return result({intent:'chat',query:'',reply:'你好呀！'});});
 assert.equal(calls,1);assert.equal(reply.text,'你好呀！');
});
test('带普通口播历史的意图请求保持JSON格式，空白结果仅重试一次且计入消耗',async()=>{
 const history=[{role:'user',content:'{"观众":"我","弹幕":"来了"}'},{role:'assistant',content:'来了就先坐，歌还在放。'}];
 const original=JSON.stringify(history);let calls=0;
 const reply=await deepseekReply(config,{user:'我',text:'晚上好',interpretIntent:true},history,async(url,options)=>{
  calls++;const payload=JSON.parse(options.body);
  assert.deepEqual(JSON.parse(payload.messages[2].content),{intent:'chat',query:'',reply:history[1].content});
  assert.equal(JSON.parse(payload.messages.at(-1).content).弹幕,'晚上好');
  if(calls===2)assert.match(payload.messages[0].content,/必须返回非空的合法 JSON/);
  return result(calls===1?'    ':{intent:'chat',query:'',reply:'晚上好，先坐会儿。'});
 });
 assert.equal(calls,2);assert.equal(reply.text,'晚上好，先坐会儿。');assert.equal(reply.tokens,34);assert.equal(JSON.stringify(history),original);
 let emptyCalls=0;
 await assert.rejects(deepseekReply(config,{text:'你好',interpretIntent:true},history,async()=>{emptyCalls++;return result('   ');}),/未返回有效回复/);
 assert.equal(emptyCalls,2);
});

test('错误结构、其他操作、凭空补歌名或混入成功口播均拒绝执行',async()=>{
 for(const plan of ['not JSON',{intent:'skip',query:'',reply:''},{intent:'song',query:'稻香',reply:''},{intent:'song',query:'晴天',reply:'已经播放啦'},{intent:'chat',query:'晴天',reply:'嗨'},{intent:'song',query:'',reply:''}]){
  await assert.rejects(deepseekReply(config,{text:'帮我放晴天',interpretIntent:true},[],async()=>result(plan)),/未执行操作/);
 }
});
test('思考按需启用，可关闭；冷场串词仅在持续空闲时触发',()=>{
 assert.equal(needsThinking({text:'你好呀'}),false);assert.equal(needsThinking({text:'我的歌排到哪了'}),true);assert.equal(needsThinking({idleNotice:true}),true);
 const idle={state,config,queueLength:0,likes:0,pendingSongs:0,songBusy:false,lastActivity:0,lastReply:0,lastIdle:0,now:121000};
 assert.equal(canIdle(idle),true);
 for(const overrides of [{speechUntil:122000},{lastActivity:10000},{lastIdle:10000},{queueLength:1},{pendingSongs:1},{songBusy:true},{likes:1},{config:{...config,autoReply:false}},{config:{...config,idleChatter:false}},{state:{...state,connection:'disconnected'}},{state:{...state,effect:{}}},{state:{...state,songs:[{}]}},{state:{...state,danceQueue:[{remaining:1}]}}])assert.equal(canIdle({...idle,...overrides}),false);
 assert.throws(()=>validateSettings({idleChatterSeconds:5},defaults));assert.throws(()=>validateSettings({adaptiveThinking:'true'},defaults));
});
