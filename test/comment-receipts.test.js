import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommentReceipts} from '../comment-receipts.js';
test('消息ID跨重启去重；同文不同ID的新消息允许；不同直播间相互隔离',()=>{
 const records=[];let now=100;
 const receipts=new CommentReceipts(records,{now:()=>now});const event={platformId:'12345',user:'主播',text:'胖胖跳舞'};
 assert.equal(receipts.accept('room',event),true);
 now+=60000;
 const restored=new CommentReceipts(JSON.parse(JSON.stringify(records)),{now:()=>now});
 assert.equal(restored.accept('room',event),false);
 assert.equal(restored.accept('room',{...event,platformId:'12346'}),true);
 assert.equal(restored.accept('other-room',event),true);
});
test('异步加载历史只建基线，短时重绘不会触发；无ID的正常后续重复口令仍能使用',()=>{
 let now=0;const receipts=new CommentReceipts([],{now:()=>now});const event={user:'主播',text:'胖胖跳舞'};
 receipts.remember('room',event,{baseline:true});
 assert.equal(receipts.accept('room',event),false);
 now=16000;assert.equal(receipts.accept('room',event),true);
 now=17000;assert.equal(receipts.accept('room',event),false);
 now=20000;assert.equal(receipts.accept('room',event),true);
});
