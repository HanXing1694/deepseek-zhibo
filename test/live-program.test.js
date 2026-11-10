import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LiveProgram,programCommand} from '../live-program.js';
import {GameRecords,liveDay} from '../game-records.js';
test('五场才转听歌；重复结算、手动接管、加场与下场听歌',()=>{
 const p=new LiveProgram();assert.equal(programCommand('观众','开启轮播','主播'),null);assert.equal(programCommand('主播','开启轮播','主播'),'enable');p.enable(true);
 for(let i=1;i<=4;i++){assert.equal(p.settle('s'+i),true);assert.equal(p.settle('s'+i),false);assert.equal(p.wantsMusic,false);}p.settle('s5');assert.equal(p.wantsMusic,true);p.control('extra-game');assert.equal(p.wantsMusic,false);p.settle('s6');assert.equal(p.wantsMusic,true);p.toMusic();p.enterMusic();assert.equal(p.data.phase,'music');p.disable();assert.equal(p.boundary(),false);assert.equal(p.data.pendingSpeech,null);
 p.enable(true);p.control('next-music');assert.equal(p.wantsMusic,true);
});
test('十分钟只累计实际音乐进度；暂停、舞蹈、跳转、重启空档不计时',()=>{
 let now=1000000;const p=new LiveProgram({now:()=>now});p.enable();let position=0;
 const observe=(options={})=>p.observeMusic({track:'a',position,playing:true,running:true,...options});observe();for(let i=0;i<600;i++){now+=1000;position++;observe();}assert.equal(p.data.musicElapsed,600000);assert.equal(p.due,true);assert.ok(p.data.pendingSpeech);assert.equal(p.boundary(),true);assert.equal(p.data.phase,'to-draw');assert.equal(p.data.pendingSpeech,null);p.opening();const id=p.data.pendingSpeech.id;assert.equal(p.ended('old'),null);assert.equal(p.ended(id),'start-draw');assert.equal(p.data.phase,'draw');assert.equal(p.data.gameTarget,5);
 p.disable();p.enable();observe();now+=1000;position++;observe({effect:true});now+=1000;position++;observe();assert.equal(p.data.musicElapsed,0);now+=1000;position++;observe();assert.equal(p.data.musicElapsed,1000);
 now+=60000;position+=60;observe();assert.equal(p.data.musicElapsed,1000);p.pause();now+=10000;position+=10;observe();assert.equal(p.data.musicElapsed,1000);
 const restored=new LiveProgram({now:()=>now,saved:p.snapshot()});now+=200000;restored.observeMusic({track:'a',position:10000,running:true,playing:true});assert.equal(restored.data.musicElapsed,1000);
});
test('超过五首待播只自动延长一次五分钟；手动延长与过时回报',()=>{
 let now=1000000;const p=new LiveProgram({now:()=>now});p.enable();p.data.musicElapsed=599000;p.observeMusic({track:'a',position:0,playing:true,running:true,waiting:6});now+=2000;p.observeMusic({track:'a',position:2,playing:true,running:true,waiting:6});assert.equal(p.data.musicTarget,900000);assert.equal(p.data.extended,true);p.data.musicElapsed=900000;now+=2000;p.observeMusic({track:'a',position:4,playing:true,running:true,waiting:6});assert.equal(p.data.musicTarget,900000);p.control('extra-music');assert.equal(p.data.musicTarget,1200000);p.cue('warning','测试');const old=p.data.pendingSpeech.id;p.replay();assert.equal(p.ended(old),null);p.disable();assert.equal(p.ended(p.data.pendingSpeech?.id),null);
});
test('今日积分只计公布前，同题只计一次，晚答不改变同分到达顺序',()=>{
 let now=Date.parse('2026-11-05T08:00:00Z');const r=new GameRecords({now:()=>now});const hit=(user,round,competitive=true,points=1)=>r.hit({sessionId:'s1',startedAt:now,round,user,points,competitive,at:now});
 hit('甲',0);now++;hit('乙',0);now++;hit('甲',1,false);assert.equal(hit('甲',0),false);assert.deepEqual(r.ranking().map(u=>[u.user,u.score]),[['甲',1],['乙',1]]);r.finish('s1',[{user:'甲',score:2},{user:'乙',score:1}]);assert.equal(r.finish('s1',[{user:'甲',score:2}]),false);assert.equal(r.profile('甲').recent.answers,2);assert.equal(r.profile('甲').recent.champions,1);assert.equal(r.profile('甲').recent.best,2);
 const restored=new GameRecords({now:()=>now,saved:r.snapshot()});assert.equal(restored.profile('甲').today.score,1);assert.equal(restored.hit({sessionId:'s1',round:0,user:'甲',points:2,competitive:true}),false);
});
test('上海凌晨4点换日，跨日整场沿用开始日；近30天过期与遗忘',()=>{
 let now=Date.parse('2026-11-05T19:59:00Z');assert.equal(liveDay(now),'2026-11-05');assert.equal(liveDay(now+60000),'2026-11-06');const r=new GameRecords({now:()=>now});r.begin('s',now);now+=120000;r.hit({sessionId:'s',round:1,user:'甲',points:2,competitive:true});assert.equal(r.ranking('2026-11-05')[0].score,2);assert.equal(r.ranking('2026-11-06').length,0);r.forget('甲');r.finish('s',[{user:'甲',score:2}]);assert.equal(r.profile('甲','2026-11-05').recent.answers,0);assert.equal(r.profile('甲','2026-11-05').recent.champions,0);now+=31*86400000;r.trim();assert.equal(r.sessions.size,0);
});
test('节目互动统计只表示已观察到的互动，跨阶段点歌与再次参赛可恢复',()=>{
 const r=new GameRecords();r.activity('a','draw','甲');r.activity('a','draw','甲');r.activity('a','music','甲',{song:true});r.activity('a','music','乙',{song:true});assert.deepEqual(r.metrics('a'),{participants:1,songAfterDraw:1,crossStage:1,returnPlayers:0});r.activity('b','draw','甲');assert.equal(r.metrics('b').returnPlayers,1);r.forget('甲');assert.equal(r.metrics('a').participants,0);assert.equal(r.metrics('a').songAfterDraw,0);
});
