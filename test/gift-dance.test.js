import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GiftDanceOrders} from '../gift-dance.js';
test('一颗小心心兑换一次，连送只累加新增数量，其他礼物不兑换',()=>{
 const queue=new GiftDanceOrders();const gift={id:'g1',user:'观众',name:'小心心',count:1};
 assert.equal(queue.accept({...gift,name:'点赞'}),0);assert.equal(queue.accept({...gift,count:1.5}),0);
 assert.equal(queue.accept(gift),1);assert.equal(queue.count,1);
 assert.equal(queue.accept(gift),0);assert.equal(queue.accept({...gift,count:5}),4);assert.equal(queue.count,5);
 queue.consume();assert.equal(queue.count,4);
 assert.equal(queue.accept({...gift,count:2}),0);assert.equal(queue.accept({...gift,user:'另一人',count:8}),0);
 assert.equal(queue.accept({...gift,id:'g2'}),1);assert.equal(queue.count,5);
});
test('重启保留次数与去重记录，不重播旧礼物',()=>{
 const queue=[],receipts=[];const gift={id:'g1',user:'观众',name:'小心心',count:3};
 const first=new GiftDanceOrders(queue,receipts);first.accept(gift);first.consume();
 const restored=new GiftDanceOrders(JSON.parse(JSON.stringify(queue)),JSON.parse(JSON.stringify(receipts)));
 assert.equal(restored.count,2);assert.equal(restored.accept(gift),0);assert.equal(restored.accept({...gift,count:4}),1);
 assert.equal(restored.count,3);
});
test('监听前已有的礼物只登记基线，不算成新订单',()=>{
 const orders=new GiftDanceOrders();const gift={id:'old-gift',user:'观众',name:'小心心',count:10};
 assert.equal(orders.accept(gift,{baseline:true}),0);assert.equal(orders.count,0);
 assert.equal(orders.accept({...gift,count:11}),1);assert.equal(orders.count,1);
});
