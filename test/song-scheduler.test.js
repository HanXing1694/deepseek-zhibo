import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SongScheduler} from '../song-scheduler.js';
function setup(){let now=0,calls=0,job=null;const scheduler=new SongScheduler(()=>calls++,{now:()=>now,setTimer:(fn,delay)=>(job={fn,delay}),clearTimer:()=>{job=null;}});return{scheduler,advance:value=>now=value,job:()=>job,calls:()=>calls};}
test('90秒按当前歌曲起点计时，队列为空最多4分钟',()=>{
 const s=setup(),currentSong={id:'a',startedAt:0};
 s.scheduler.sync({running:true,currentSong,waitingCount:0,seconds:90});assert.equal(s.job().delay,240000);
 s.advance(10000);s.scheduler.sync({running:true,currentSong,waitingCount:2,seconds:90});assert.equal(s.job().delay,80000);
 s.job().fn();assert.equal(s.calls(),1);
 s.advance(90000);s.scheduler.sync({running:true,currentSong:{id:'b',startedAt:90000},waitingCount:1,seconds:90});assert.equal(s.job().delay,90000);
});
test('满90秒后新点歌立即安排，暂停取消任务，清空队列恢复4分钟上限',()=>{
 const s=setup(),currentSong={startedAt:0};s.advance(100000);
 s.scheduler.sync({running:true,currentSong,waitingCount:1,seconds:90});assert.equal(s.job().delay,0);const stale=s.job();
 s.scheduler.sync({running:false,currentSong,waitingCount:1,seconds:90});assert.equal(s.job(),null);stale.fn();assert.equal(s.calls(),0);
 s.scheduler.sync({running:true,currentSong,waitingCount:0,seconds:90});assert.equal(s.job().delay,140000);
});

test('等待5首仍为90秒，超过5首缩到60秒；队列缩短时取消旧切歌任务',()=>{
 const s=setup(),currentSong={startedAt:0};s.advance(40000);
 s.scheduler.sync({running:true,currentSong,waitingCount:5,seconds:90});assert.equal(s.job().delay,50000);const normal=s.job();
 s.scheduler.sync({running:true,currentSong,waitingCount:6,seconds:90});assert.equal(s.job().delay,20000);normal.fn();assert.equal(s.calls(),0);const crowded=s.job();
 s.scheduler.sync({running:true,currentSong,waitingCount:5,seconds:90});assert.equal(s.job().delay,50000);crowded.fn();assert.equal(s.calls(),0);
 s.advance(65000);s.scheduler.sync({running:true,currentSong,waitingCount:6,seconds:90});assert.equal(s.job().delay,0);
 s.job().fn();assert.equal(s.calls(),1);
});

test('手动切歌受4分钟上限约束，更短间隔继续生效',()=>{
 const s=setup(),currentSong={startedAt:0};
 s.scheduler.sync({running:true,currentSong,waitingCount:6,seconds:0});assert.equal(s.job().delay,240000);
 s.scheduler.sync({running:true,currentSong,waitingCount:6,seconds:30});assert.equal(s.job().delay,30000);
});

test('超长设置、无人排队和随机电台均不超过4分钟',()=>{
 const s=setup();s.advance(200000);
 for(const [waitingCount,seconds] of [[0,90],[0,0],[1,1800],[1,240]]){
 s.scheduler.sync({running:true,currentSong:{startedAt:0,autoplay:true},waitingCount,seconds});assert.equal(s.job().delay,40000);
 }
 s.advance(250000);s.scheduler.sync({running:true,currentSong:{startedAt:0},waitingCount:0,seconds:0});assert.equal(s.job().delay,0);s.job().fn();assert.equal(s.calls(),1);
 s.scheduler.sync({running:true,currentSong:{startedAt:0,status:'播放结束'},waitingCount:0,seconds:90});assert.equal(s.scheduler.timer,null);
});
