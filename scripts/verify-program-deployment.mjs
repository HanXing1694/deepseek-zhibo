import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const api=async(route,data)=>{const r=await fetch('http://127.0.0.1:3210/api/'+route,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();assert.ok(r.ok,JSON.stringify(value));return value;};
const beforeMode=process.argv.includes('--before');
if(beforeMode){const state=await api('state');await writeFile('output/pre-program-deploy.json',JSON.stringify({recordedAt:Date.now(),state},null,2));console.log(JSON.stringify({running:state.running,connection:state.connection,game:state.drawGame?.phase,session:state.drawGame?.session,round:state.drawGame?.round,song:state.currentSong?.title,queue:state.songs,outputs:state.outputWindows}));}
else{
 const {state:before,recordedAt}=JSON.parse(await readFile('output/pre-program-deploy.json','utf8'));
 if(process.argv.includes('--enable'))await api('program/control',{action:'enable'});
 let state=await api('state');assert.equal(state.running,before.running);assert.ok(['watching','receiving'].includes(state.connection));assert.equal(state.program.enabled,process.argv.includes('--enable')?true:before.program?.enabled??true);assert.equal(state.program.gameTarget,before.program?.gameTarget||5);assert.ok(!state.drawGame.paused);
 for(const song of before.songs)assert.ok(state.songs.some(s=>s.id===song.id)||state.currentSong?.id===song.id,'original queue retained');
 if(before.drawGame?.phase!=='off'){assert.notEqual(state.drawGame.phase,'off');assert.ok(state.drawGame.session>=before.drawGame.session);}
 const first=state.musicPlayback;await new Promise(r=>setTimeout(r,3000));state=await api('state');assert.ok(state.musicPlayback.playing&&(state.musicPlayback.track!==first?.track||state.musicPlayback.position>first.position),'music advances');
 const heard=()=>state.collectorHealth?.lastMessageAt>=recordedAt;for(let i=0;i<15&&!heard();i++){await new Promise(r=>setTimeout(r,1000));state=await api('state');}
 const outputs=state.outputWindows||[],original=before.outputWindows?.find(o=>!o.silent&&o.voiceEnabled),retained=outputs.find(o=>o.id===original?.id);
 const result={running:state.running,connection:state.connection,listenerReady:['watching','receiving'].includes(state.connection),receivedAfterUpdate:heard(),collector:state.collectorHealth,program:state.program,game:{phase:state.drawGame.phase,session:state.drawGame.session,round:state.drawGame.round},league:state.gameLeague,music:state.musicPlayback,song:state.currentSong?.title,queue:state.songs,outputs,originalOutputRetained:!!retained,originalSoundReady:!!(retained?.audioReady&&retained?.voiceEnabled&&retained?.videoEnabled),originalFullscreenRetained:retained?.fullscreen===original?.fullscreen,newCaptureUI:retained?.uiVersion==='five-game-v1',stats:state.stats,logs:state.logs.slice(-8)};
 await writeFile('output/program-deployment-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
