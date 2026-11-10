import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isRoomEntry,isHostEntry} from '../host-welcome.js';
import {deepseekReply,defaults} from '../lib.js';

test('进场通知与观众实际发言分开，显式聊天类型优先',()=>{
 for(const text of ['来了','来了！','进入直播间','进入了直播间','枫树下的柚柚 来了'])assert.equal(isRoomEntry({user:'枫树下的柚柚',text}),true);
 for(const text of ['我来了，放首歌','来了以后听什么','点歌 晴天'])assert.equal(isRoomEntry({user:'柚柚',text}),false);
 assert.equal(isRoomEntry({user:'柚柚',text:'来了',kind:'chat'}),false);
 assert.equal(isHostEntry({user:'主播',text:'来了',kind:'chat'},'主播'),false);
});

test('欢迎请求明确是事件，不是弹幕，也不进入点歌意图模式',async()=>{
 const result=await deepseekReply({...defaults,apiKey:'test'},{user:'柚柚',text:'来了',entryNotice:true,interpretIntent:true},[],async(url,options)=>{
  const body=JSON.parse(options.body);
  assert.match(body.messages[0].content,/进入直播间通知，不是观众发言/);
  const event=JSON.parse(body.messages.at(-1).content);
  assert.equal(event.事件,'进入直播间');assert.equal(event.弹幕,undefined);
  assert.equal(body.response_format,undefined);
  return {ok:true,json:async()=>({choices:[{message:{content:'欢迎柚柚，进来坐坐，听会儿歌。'}}]})};
 });
 assert.equal(result.text,'欢迎柚柚，进来坐坐，听会儿歌。');assert.equal(result.songQuery,undefined);
});
