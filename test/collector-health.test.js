import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectorHealth} from '../collector-health.js';
test('无新弹幕不等于掉线，零节点需诊断，只有采集脚本无响应才自动恢复',()=>{
 const sample={heartbeat:10000,observing:true,ready:true,nodes:2};
 assert.equal(collectorHealth(sample,20000).status,'healthy');assert.equal(collectorHealth({...sample,nodes:0},20000).recover,false);
 assert.equal(collectorHealth(sample,50000).recover,true);assert.equal(collectorHealth(null).recover,true);
 assert.equal(collectorHealth({...sample,responsive:true},50000).recover,false);
 for(const [field,status] of [['verification','verification'],['login','login'],['error','selector-error']]){
  const result=collectorHealth({...sample,[field]:true},50000);assert.equal(result.status,status);assert.equal(result.recover,false);
 }
});
