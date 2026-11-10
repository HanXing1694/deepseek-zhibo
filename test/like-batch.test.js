import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LikeBatch,isLikeNotice} from '../like-batch.js';
import {deepseekReply,defaults} from '../lib.js';

test('只识别独立点赞提醒，不吞掉聊天或点歌',()=>{
 for(const text of ['为主播点赞了','为主播点了赞','给主播点赞了！','点赞了','点赞'])assert.equal(isLikeNotice(text),true,text);
 for(const text of ['怎么点赞','我点赞了，能点首歌吗','谢谢大家点赞','点赞有什么用？','点歌 点赞','为主播点赞了，晚上好'])assert.equal(isLikeNotice(text),false,text);
});
test('密集点赞合并成一批，等待窗口固定，不被新点赞无限延后',()=>{
 const batch=new LikeBatch();batch.add(0);
 for(let i=1;i<500;i++)batch.add(i*20);
 assert.equal(batch.take(14999),null);
 const event=batch.take(15000);assert.equal(event.likeNotice.notifications,500);
 assert.equal(event.user,'海底点赞团');assert.equal(batch.take(15001),null);
 batch.add(16000);batch.add(32000);
 assert.equal(batch.readyAt,60000);assert.equal(batch.take(59999),null);
 assert.equal(batch.take(60000).likeNotice.notifications,2);
});
test('暂停或关闭自动回复时清除待感谢的点赞',()=>{
 const batch=new LikeBatch();batch.add(0);batch.reset();
 assert.equal(batch.readyAt,Infinity);assert.equal(batch.take(999999),null);
 batch.add(1000000);assert.equal(batch.readyAt,1015000);
});
test('点赞批次通过 DeepSeek 生成一次集体感谢',async()=>{
 const batch=new LikeBatch();batch.add(0);batch.add(1);
 const result=await deepseekReply({...defaults,apiKey:'isolated-test'},batch.take(15000),[],async(url,options)=>{
   const messages=JSON.parse(options.body).messages;
   assert.match(messages[0].content,/统一感谢大家/);
   assert.match(messages[0].content,/不要逐个点名/);
   assert.match(messages.at(-1).content,/2条点赞提醒/);
   return {ok:true,json:async()=>({choices:[{message:{content:'谢谢大家的点赞，海底小屋都亮起来啦！'}}]})};
 });
 assert.match(result.text,/谢谢大家/);
});
