import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RuntimeStore} from '../runtime-store.js';
import {questions} from '../draw-and-guess.js';

test('游戏完整链路：主播口令、六轮积分、实际语音完成、循环、同一播放队列与无回退切换',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-draw-')),base='http://127.0.0.1:33237/api/';let child;
 const original={id:'original',title:'原来那首歌',artist:'原歌手',backend:'desk',position:42,duration:240,startedAt:Date.now()-42000,status:'正在播放'};
 const waiting={id:'waiting',title:'排队歌曲',artist:'歌手',mid:'waiting-mid',user:'观众'};
 await writeFile(path.join(dir,'settings.json'),JSON.stringify({room:'123456',hostNickname:'Han_Skr',autoReply:false,speech:true,musicVolume:.3}));
 await new RuntimeStore(dir).save({running:true,connection:'disconnected',connectionWanted:false,songs:[waiting],currentSong:original,danceQueue:[],comments:[],logs:[],stats:{comments:0,replies:0,tokens:0,songs:0}},'123456');
 const stop=async()=>{if(!child||child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;};
 t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});
 const start=async()=>{child=spawn(process.execPath,['--import','./scripts/draw-game-fixture.mjs','server.js'],{env:{...process.env,PORT:'33237',WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',b=>errors+=b);await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`server exited ${code}: ${errors}`)));});};
 const call=async(route,data)=>{const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));return result;};
 const until=async predicate=>{for(let i=0;i<100;i++){const state=await call('state');if(predicate(state))return state;await new Promise(r=>setTimeout(r,50));}throw new Error('game state timeout');};
 const comment=(user,text)=>call('test-comment',{user,text});
 await start();await until(s=>s.currentSong?.id==='original'&&s.drawGame?.phase==='off');
 await comment('观众','你画我猜');assert.equal((await call('state')).drawGame.phase,'off');
 await comment('Han_Skr','你画我猜');await until(s=>s.currentSong?.id==='original'&&s.drawGame.phase==='ready');let state=await call('state');assert.equal(state.drawGame.phase,'ready');assert.deepEqual(state.songs,[waiting]);assert.equal((await call('music/status')).player.volume,0);
 await comment('Han_Skr','开始画画');state=await call('state');const session=state.drawGame.sessionId;
 await comment('Han_Skr','开始画画');assert.equal((await call('state')).drawGame.sessionId,session);
 // Find the current answer by trying the finite fixture vocabulary; production state never exposes it.
 const words=questions.map(q=>q[0]);
 let answer;for(const word of words){await comment('桃子',word);if((await call('state')).drawGame.scores.length){answer=word;break;}}
 await comment('阿星',answer);await comment('桃子',answer);state=await call('state');assert.deepEqual(state.drawGame.scores.map(s=>s.score),[2,1]);assert.equal(state.stats.tokens,0);assert.ok(state.stats.replies>=3);assert.equal(state.reply.kind,'game-host');assert.match(state.reply.text,/桃子.*第一个答对/);
 const praise=state.reply;await call('speech-status',{id:praise.id,type:'pending'});await call('speech-status',{id:praise.id,type:'speaking'});assert.equal((await call('music/status')).player.volume,0);await call('speech-status',{id:praise.id,type:'ended'});assert.equal((await call('music/status')).player.volume,0);
 assert.equal(state.drawGame.answerLength,[...answer].length);assert.equal(state.drawGame.answer,undefined);
 await writeFile(path.join(dir,'clock-offset'),String(state.drawGame.roundEndsAt-5000-Date.now()));state=await until(s=>s.drawGame.revealed);assert.equal(state.drawGame.answer,answer);assert.equal(state.reply.gameCue.type,'reveal');assert.match(state.reply.text,new RegExp(`答案是${answer}`));await comment('公布后才作答',answer);await comment('桃子',answer);state=await call('state');assert.deepEqual(state.drawGame.scores.map(s=>s.score),[2,1,1]);assert.equal(state.reply.gameCue.type,'reveal','late points must not interrupt the answer announcement');
 await call('run',{running:false});await writeFile(path.join(dir,'clock-offset'),'60000');await new Promise(r=>setTimeout(r,1100));assert.equal((await call('state')).drawGame.round,1);await call('run',{running:true});
 const offset=60000;await writeFile(path.join(dir,'clock-offset'),String(offset+180000));state=await until(s=>s.drawGame.phase==='settlement');assert.equal(state.reply.kind,'game');assert.match(state.reply.text,/第一名桃子/);assert.match(state.reply.text,/第二名阿星/);const id=state.drawGame.settlementId;
 await call('speech-status',{id,type:'ended'});assert.equal((await call('state')).drawGame.phase,'settlement','generic ended includes failures and must not start another game');
 assert.equal((await call('draw-game/speech-ended',{id:'old'})).accepted,false);
 await call('speech-status',{id,type:'speaking'});await call('draw-game/speech-ended',{id});state=await call('state');assert.equal(state.drawGame.phase,'drawing');assert.equal(state.drawGame.session,2);assert.deepEqual(state.drawGame.scores,[]);assert.equal((await call('draw-game/speech-ended',{id})).accepted,false);
 // Persist and restore an active game, then exit using the original host command.
 await new Promise(r=>setTimeout(r,700));await stop();await start();state=await until(s=>s.drawGame?.session===2);assert.equal(state.drawGame.phase,'drawing');await until(s=>s.currentSong?.backend==='desk');
 state=await call('state');const musicBeforeExit=state.currentSong,queueBeforeExit=state.songs;await comment('Han_Skr','返回听歌');state=await until(s=>s.drawGame.phase==='off');assert.equal(state.currentSong.id,musicBeforeExit.id);assert.equal(state.currentSong.position,musicBeforeExit.position);assert.deepEqual(state.songs,queueBeforeExit);assert.equal((await call('music/status')).player.volume,0);assert.equal((await call('draw-game/speech-ended',{id})).accepted,false);
 await call('run',{running:false});
});
