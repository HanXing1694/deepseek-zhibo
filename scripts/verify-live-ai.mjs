// Read-only model verification: no ingest, playback, voice or queue writes.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,validateSettings,deepseekReply} from '../lib.js';
import {liveContext} from '../live-context.js';
const config=validateSettings(JSON.parse(await readFile('data/settings.json','utf8')),defaults);
if(process.env.DEEPSEEK_API_KEY)config.apiKey=process.env.DEEPSEEK_API_KEY;
const state=await (await fetch('http://127.0.0.1:3210/api/state')).json();
const report=[];
for(const [text,intent] of [['帮我放晴天','song'],['来一首周杰伦的晴天','song'],['有没有周杰伦','song'],['我喜欢晴天但不点歌','chat'],['有没有周杰伦的新闻','chat'],['现在放的是什么','chat']]){
 const reply=await deepseekReply(config,{user:'验证观众',text,interpretIntent:true,liveContext:liveContext(state,'验证观众',config)},[]);
 assert.equal(reply.songQuery?'song':'chat',intent,text);
 if(text==='现在放的是什么'&&state.currentSong)assert.ok(reply.text.includes(state.currentSong.title),reply.text);
 report.push({input:text,...reply});console.log(JSON.stringify(report.at(-1)));
}
// A clearly isolated fixture supplies a queue for a viewer absent from the live queue.
const fixture={...state,songs:[{title:'夜曲',artist:'周杰伦',user:'其他观众'},{title:'晴天',artist:'周杰伦',user:'验证观众'}]};
const reply=await deepseekReply(config,{user:'验证观众',text:'我的歌排到哪了',interpretIntent:true,liveContext:liveContext(fixture,'验证观众',config)},[]);
assert.ok(!reply.songQuery&&/2|二|两/u.test(reply.text),reply.text);report.push({fixture:true,text:'我的歌排到哪了',...reply});console.log(JSON.stringify(report.at(-1)));
const idle=await deepseekReply(config,{user:'小鲸电台',text:'根据现场自然接一句音乐话题。',idleNotice:true,liveContext:liveContext(state,'小鲸电台',config)},[]);
assert.ok(idle.text&&!idle.songQuery);report.push({idle:true,...idle});console.log(JSON.stringify(report.at(-1)));
await writeFile('output/live-ai-verification.json',JSON.stringify({verifiedAt:Date.now(),model:config.model,currentSong:state.currentSong?.title,report},null,2));
