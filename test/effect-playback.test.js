import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EffectPlayback} from '../effect-playback.js';
test('先确认音乐暂停才播视频，结束恢复并补回歌曲计时',async()=>{
 let now=0,timer;const events=[];
 const player=new EffectPlayback({pause:async()=>{events.push('pause');now=500;return {resume:true};},resume:async token=>{assert.equal(token.resume,true);events.push('resume');now+=300;},onStart:e=>{events.push('start');assert.equal(e.startedAt,500);},onStop:()=>events.push('stop'),onRelease:elapsed=>events.push(elapsed),now:()=>now,setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}});
 await player.start({durationMs:10050});assert.deepEqual(events,['pause','start']);assert.equal(player.locked,true);
 assert.equal(await player.start({durationMs:10050}),false);
 now=10550;await player.stop();assert.deepEqual(events,['pause','start','stop','resume',10350]);assert.equal(player.locked,false);
 await player.stop();assert.equal(events.filter(e=>e==='resume').length,1);
});
test('暂停准备中点击停止：不播放视频，并恢复刚暂停的音乐',async()=>{
 let finishPause;const events=[];
 const player=new EffectPlayback({pause:()=>new Promise(resolve=>{finishPause=resolve;}),resume:async()=>events.push('resume'),onStart:()=>events.push('start'),onStop:()=>events.push('stop')});
 const starting=player.start({durationMs:10050}),stopping=player.stop();
 finishPause({resume:true});assert.equal(await starting,false);await stopping;
 assert.deepEqual(events,['resume']);assert.equal(player.locked,false);
});
test('不能确认音乐暂停时不启动舞蹈，不使用盲目切换键',async()=>{
 let started=false;
 const player=new EffectPlayback({pause:async()=>{throw new Error('pause failed');},resume:async()=>{},onStart:()=>{started=true;},onStop:()=>{}});
 await assert.rejects(player.start({durationMs:10050}),/pause failed/);assert.equal(started,false);assert.equal(player.locked,false);
});
