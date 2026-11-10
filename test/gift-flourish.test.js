import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flourishKind,GiftNotices} from '../gift-flourish.js';
test('常见礼物对上短特效，陌生的短礼物名也能放一场',()=>{
  assert.equal(flourishKind('小心心'),'hearts');
  assert.equal(flourishKind('玫瑰花'),'roses');
  assert.equal(flourishKind('大啤酒'),'beer');
  assert.equal(flourishKind('人气票'),'tickets');
  assert.equal(flourishKind('灯牌'),'lanterns');
  assert.equal(flourishKind('亲吻'),'kiss');
  assert.equal(flourishKind('小海豚'),'spark');
  assert.equal(flourishKind(''),null);
  assert.equal(flourishKind('这是一句超过十六个字的礼物名所以不算'),null);
});
test('小心心不进这条队列，其他礼物按新增数量触发且基线不回放',()=>{
  const notices=new GiftNotices();
  const rose={id:'r1',user:'泡泡',name:'玫瑰',count:1};
  assert.equal(notices.accept({...rose,name:'小心心'}),0);
  assert.equal(notices.accept(rose,{baseline:true}),0);
  assert.equal(notices.accept(rose),0);
  assert.equal(notices.accept({...rose,count:4}),3);
  assert.equal(notices.accept({...rose,user:'别人',count:9}),0);
});
