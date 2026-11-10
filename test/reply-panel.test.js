import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReplyPanelTimer} from '../public/reply-panel.js';
function fixture(){let now=0,id=0;const tasks=new Map(),events=[];const panel=new ReplyPanelTimer({show:()=>events.push('show'),hide:()=>events.push('hide'),setTimer:(fn,delay)=>{tasks.set(++id,{fn,at:now+delay});return id;},clearTimer:key=>tasks.delete(key)});return {panel,events,advance(ms){now+=ms;for(const [key,task]of tasks)if(task.at<=now){tasks.delete(key);task.fn();}}};}
test('以语音结束为基准，完整停留5秒才隐藏',()=>{
 const {panel,events,advance}=fixture();panel.newReply('a');panel.pending('a');advance(8000);assert.equal(events.includes('hide'),false);
 panel.speaking('a');advance(15000);assert.equal(events.includes('hide'),false);
 panel.ended('a');advance(4999);assert.equal(events.includes('hide'),false);advance(1);assert.equal(events.at(-1),'hide');
});
test('新回复取消旧计时，旧语音结束不能隐藏新回复',()=>{
 const {panel,events,advance}=fixture();panel.newReply('a');advance(4000);panel.newReply('b');panel.pending('b');panel.ended('a');advance(5000);assert.equal(events.includes('hide'),false);
 panel.speaking('b');panel.ended('b');advance(5000);assert.equal(events.at(-1),'hide');
});
test('静音或无法播报时五秒后收起，同一条状态更新不反复打开',()=>{
 const {panel,events,advance}=fixture();panel.newReply('a');advance(5000);assert.equal(events.at(-1),'hide');panel.newReply('a');assert.equal(events.at(-1),'hide');
});
