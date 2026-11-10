import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConversationTurns} from '../live-context.js';
import {liveHealth} from '../public/live-health.js';
import {deepseekReply,defaults,validateSettings} from '../lib.js';
test('同一观众的近期对话独立、有界、过期；纠正误判不执行历史点歌',async()=>{
 const turns=new ConversationTurns();
 turns.remember('甲','能放动漫吗','你想听哪首动漫歌？',1000);
 assert.equal(turns.recent('乙',1001).length,0);assert.equal(turns.recent('甲',601001).length,0);
 const recent=turns.recent('甲',1001);recent[0].回复='被修改';assert.notEqual(turns.recent('甲',1001)[0].回复,'被修改');
 let calls=0;
 const reply=await deepseekReply({...defaults,apiKey:'fixture'},{user:'甲',text:'不是音乐，是动漫',interpretIntent:true,conversation:turns.recent('甲',1001)},[],async(_,options)=>{
  const body=JSON.parse(options.body);assert.equal(JSON.parse(body.messages.at(-1).content).同一观众近期对话[0].原话,'能放动漫吗');
  assert.match(body.messages[0].content,/最新说法为准/);
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(++calls===1?{intent:'song',query:'动漫',reply:''}:{intent:'chat',query:'',reply:'明白，你说的是动画作品，想聊哪一部？'})},finish_reason:'stop'}]})};
 });assert.equal(calls,2);assert.equal(reply.songQuery,undefined);assert.match(reply.text,/动画作品/);
 for(let i=0;i<10;i++)turns.remember('甲','第'+i,'回复',2000+i);assert.equal(turns.recent('甲',2010).length,4);
 turns.clear();assert.equal(turns.recent('甲',2010).length,0);
});
test('健康面板区分监听、真实弹幕、过期播放回报及多窗口发声',()=>{
 const now=200000,state={connection:'watching',collectorHealth:{status:'healthy'},songs:[]};
 let health=liveHealth(state,[],now);assert.equal(health[0].text,'监听就绪');assert.match(health[1].text,/尚未收到/);assert.match(health[2].text,/尚无窗口/);
 const output={voiceEnabled:true,audioReady:true,updatedAt:now};
 state.currentSong={id:'one'};state.musicPlayback={track:'one',playing:true,position:20,checkedAt:now,lastAdvancedAt:now,ducked:true};
 health=liveHealth(state,[output],now);assert.equal(health[2].level,'ok');assert.match(health[3].text,/降低音量/);
 assert.equal(liveHealth(state,[output,output],now)[2].level,'warn');
 assert.equal(liveHealth(state,[output],now+16001)[2].level,'warn');assert.equal(liveHealth(state,[],now+8001)[3].level,'warn');
 assert.throws(()=>validateSettings({musicVolume:2},defaults));assert.throws(()=>validateSettings({musicDucking:1},defaults));
});
