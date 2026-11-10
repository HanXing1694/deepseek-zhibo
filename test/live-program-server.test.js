import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RuntimeStore} from '../runtime-store.js';
import {questions} from '../draw-and-guess.js';
test('五场循环、游戏点歌、今日战绩、重启、音乐边界和开场语音完整链路',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-program-')),base='http://127.0.0.1:33267/api/';let child,offset=0;
 const original={id:'original',title:'原歌曲',artist:'歌手',backend:'desk',position:42,duration:240,startedAt:Date.now()-42000,status:'正在播放'};
 await writeFile(path.join(dir,'settings.json'),JSON.stringify({room:'123456',hostNickname:'主播',autoReply:false,naturalSongs:false,speech:true,musicVolume:.3}));
 await new RuntimeStore(dir).save({running:true,connection:'disconnected',connectionWanted:false,songs:[],currentSong:original,danceQueue:[],comments:[],logs:[],stats:{comments:0,replies:0,tokens:0,songs:0}},'123456');
 const stop=async()=>{if(!child||child.exitCode!==null)return;const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;};t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});
 const start=async()=>{child=spawn(process.execPath,['--import','./scripts/live-program-fixture.mjs','server.js'],{env:{...process.env,PORT:'33267',WHALE_DATA_DIR:dir,DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{let errors='';child.stderr.on('data',b=>errors+=b);child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(new Error(`server exited ${c}: ${errors}`)));});};
 const call=async(route,data)=>{const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));return result;};
 const until=async predicate=>{for(let i=0;i<160;i++){const s=await call('state');if(predicate(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('program state timeout: '+JSON.stringify((await call('state')).program));};
 const comment=(user,text)=>call('test-comment',{user,text});const finish=async(route,id)=>{await call('speech-status',{id,type:'pending'});await call('speech-status',{id,type:'speaking'});await call('speech-status',{id,type:'ended'});return call(route,{id});};
 const jump=async timestamp=>{offset=timestamp-Date.now();await writeFile(path.join(dir,'clock-offset'),String(offset));};
 await start();await until(s=>s.currentSong?.id==='original');await comment('观众','开启轮播');assert.equal((await call('state')).program.enabled,false);
 await comment('主播','你画我猜');await until(s=>s.currentSong?.id==='original'&&s.drawGame.phase==='ready');await call('program/control',{action:'enable'});let ready=await call('state');assert.equal(ready.drawGame.phase,'ready');const initialOpening=ready.program.pendingSpeech.id;await call('program/control',{action:'enable'});assert.equal((await call('state')).program.pendingSpeech.id,initialOpening);await finish('program/speech-ended',initialOpening);
 let s=await call('state');assert.equal(s.program.gameTarget,5);const initial=s.drawGame.sessionId;
 await new Promise(r=>setTimeout(r,750));const privateGame=JSON.parse(await readFile(path.join(dir,'draw-game.json'),'utf8'));const answer=questions[privateGame.data.deck[0]][0];
 await comment('桃子',answer);await comment('桃子',answer);s=await call('state');assert.equal(s.gameLeague.top[0].score,2);
 await comment('点歌者','点歌 晴天');s=await call('state');assert.equal(s.songs.length,0);assert.equal(s.currentSong.id,'original');assert.match(s.gameLeague.query.text,/点歌已关闭/);assert.equal(s.stats.tokens,0);
 await comment('点歌者','点歌 江南');assert.equal((await call('state')).songs.length,0);
 await jump(s.drawGame.roundEndsAt-4999);s=await until(s=>s.drawGame.revealed);await comment('晚来',answer);s=await call('state');assert.equal(s.drawGame.scores.find(r=>r.user==='晚来').score,1);assert.ok(!s.gameLeague.top.some(r=>r.user==='晚来'));
 for(let game=1;game<=5;game++){
  s=await call('state');await jump(s.drawGame.endsAt+1);s=await until(s=>s.drawGame.phase==='settlement');assert.equal(s.program.completed,game);
  if(game===5){assert.match(s.reply.text,/接下来听十分钟/);assert.ok(!s.reply.text.includes('下一场马上开始'));await call('speech-status',{id:s.reply.id,type:'ended'});assert.equal((await call('state')).drawGame.phase,'settlement');}
  const id=s.drawGame.settlementId;assert.equal((await finish('draw-game/speech-ended',id)).accepted,true);
  if(game<5){s=await call('state');assert.equal(s.drawGame.phase,'drawing');assert.equal(s.program.gameNumber,game+1);}
  if(game===3){await call('run',{running:false});await call('run',{running:true});await stop();await start();s=await until(s=>s.program.gameNumber===4);assert.equal(s.drawGame.phase,'drawing');assert.equal(s.gameLeague.top[0].score,2);}
 }
 s=await until(s=>s.program.phase==='music');assert.equal(s.drawGame.phase,'off');assert.ok(s.currentSong?.id);assert.equal(s.songs.length,0);assert.equal(s.sharedMusic.track,s.currentSong.id);assert.equal(s.gameLeague.top[0].score,2);assert.equal(s.gameLeague.top[0].champions,1);
 await comment('桃子','我的战绩');assert.match((await call('state')).gameLeague.query.text,/今日 2 分/);
 await new Promise(r=>setTimeout(r,800));await stop();let saved=JSON.parse(await readFile(path.join(dir,'live-program.json'),'utf8'));saved.program.data.musicElapsed=599000;await writeFile(path.join(dir,'live-program.json'),JSON.stringify(saved));await writeFile(path.join(dir,'advancing-music'),'yes');await start();
 s=await until(s=>s.program.musicElapsed>=600000);assert.equal(s.gameLeague.top[0].score,2);await jump(Date.now()+offset+240000);s=await until(s=>s.program.phase==='opening');assert.equal(s.drawGame.phase,'ready');const opening=s.program.pendingSpeech.id;
 await call('speech-status',{id:opening,type:'ended'});assert.equal((await call('program/speech-ended',{id:opening})).accepted,false);assert.equal(s.drawGame.settlementId,opening);await finish('draw-game/speech-ended',opening);assert.equal((await call('program/speech-ended',{id:opening})).accepted,false);s=await call('state');assert.equal(s.drawGame.phase,'drawing');assert.notEqual(s.drawGame.sessionId,initial);assert.equal(s.program.gameNumber,1);assert.equal(s.program.gameTarget,5);assert.equal(s.gameLeague.top[0].score,2);
 await call('program/control',{action:'next-music'});assert.equal((await call('state')).program.nextMusic,true);await call('program/control',{action:'extra-game'});assert.equal((await call('state')).program.gameTarget,6);await call('program/control',{action:'disable'});assert.equal((await call('state')).drawGame.phase,'drawing');
 await comment('桃子','忘记我');assert.ok(!(await call('state')).gameLeague.top.some(r=>r.user==='桃子'));await call('run',{running:false});
});
