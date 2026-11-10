// Isolated model requests only: never inject test messages into the live room.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AudienceMemory,liveContext} from '../live-context.js';
import {defaults,validateSettings,deepseekReply} from '../lib.js';
const config=validateSettings(JSON.parse(await readFile('data/settings.json','utf8')),defaults);
if(process.env.DEEPSEEK_API_KEY)config.apiKey=process.env.DEEPSEEK_API_KEY;
const now=Date.now(),memory=new AudienceMemory([],now),user='常客记忆验证';
memory.remember({source:'douyin',user,text:'我最近喜欢听动漫歌曲'},null,now-3600000);
memory.remember({source:'douyin',user},{title:'夜曲',artist:'周杰伦'},now-3500000);
const results=[];
for(const [text,known] of [['还记得我之前点过什么吗',true],['还记得我吗',false]]){
 const event={user:known?user:'全新记忆验证',text,source:'douyin',interpretIntent:true};
 const context=liveContext({songs:[]},event.user,config,memory.context(event,now),now);
 const reply=await deepseekReply(config,{...event,liveContext:context},[]);
 assert.ok(reply.text&&!reply.songQuery,'Memory questions must not enqueue music');
 assert.ok(!/昨天|上次来|上回聊|又来了/u.test(reply.text),'Do not invent dates or previous visits');
 if(known)assert.ok(reply.text.includes('夜曲'),'Recall the recorded song');
 else assert.ok(!/夜曲|周杰伦|动漫|(?:之前|上回|上次).*聊/u.test(reply.text),'Never invent prior conversations or attribute another viewer’s facts to a new viewer');
 results.push({text,known,reply:reply.text});
}
await writeFile('output/regular-memory-model-verification.json',JSON.stringify({verifiedAt:now,results},null,2));
console.log(JSON.stringify(results));
