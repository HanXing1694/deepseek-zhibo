import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechQueue} from '../public/speech-queue.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('回复必须等上一条语音完成，待播点歌结果优先，字幕随实际播放切换',async()=>{
 const started=[],finishes=[];
 const queue=new SpeechQueue({play:r=>new Promise(resolve=>finishes.push(resolve)),onStart:r=>started.push(r.id)});
 queue.enqueue({id:'one',kind:'chat'});queue.enqueue({id:'welcome',kind:'entry'});queue.enqueue({id:'song',kind:'song'});
 assert.deepEqual(started,['one']);finishes.shift()();await tick();assert.deepEqual(started,['one','song']);
 finishes.shift()();await tick();assert.deepEqual(started,['one','song','welcome']);finishes.shift()();await tick();assert.equal(queue.busy,false);
});
test('舞蹈期间不开始语音，过时欢迎丢弃，暂停清队列后不复播旧回复',async()=>{
 let now=0,paused=true;const played=[];
 const queue=new SpeechQueue({play:async r=>played.push(r.id),paused:()=>paused,now:()=>now});
 queue.enqueue({id:'old',kind:'entry'});queue.enqueue({id:'song',kind:'song'});now=21000;paused=false;await queue.drain();
 assert.deepEqual(played,['song']);paused=true;queue.enqueue({id:'cancelled',kind:'chat'});queue.clear();paused=false;await queue.drain();assert.deepEqual(played,['song']);
});
test('语音失败释放队列，后续回复仍能正常播放',async()=>{
 const played=[];const queue=new SpeechQueue({play:async r=>{played.push(r.id);if(r.id==='bad')throw new Error('TTS failed');}});
 queue.enqueue({id:'bad',kind:'chat'});queue.enqueue({id:'next',kind:'chat'});await tick();assert.deepEqual(played,['bad','next']);assert.equal(queue.busy,false);
});
