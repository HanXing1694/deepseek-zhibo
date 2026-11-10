import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const call=async route=>{const r=await fetch('http://127.0.0.1:3210/api/'+route);assert.ok(r.ok);return r.json();};
const state=await call('state');
if(process.argv.includes('--before')){await writeFile('output/pre-turtle-deploy.json',JSON.stringify(state,null,2));console.log(JSON.stringify({running:state.running,connection:state.connection,draw:state.drawGame?.phase,session:state.drawGame?.session,song:state.currentSong?.title,waiting:state.songs.length,outputs:state.outputWindows}));}
else{
 const before=JSON.parse(await readFile('output/pre-turtle-deploy.json','utf8'));
 assert.equal(state.running,before.running);assert.ok(['watching','receiving'].includes(state.connection));assert.equal(state.turtleGame.phase,'off');assert.deepEqual(state.songs,before.songs);assert.ok(state.stats.comments>=before.stats.comments);assert.ok(state.stats.replies>=before.stats.replies);
 if(before.drawGame?.phase!=='off'){assert.notEqual(state.drawGame.phase,'off');assert.ok(state.drawGame.session>=before.drawGame.session);}
 const assets=await Promise.all(['turtle-game.js','turtle-game.css','turtle-game-background.png'].map(async file=>{const r=await fetch('http://127.0.0.1:3210/'+file);assert.ok(r.ok,file);return {file,bytes:(await r.arrayBuffer()).byteLength};}));
 const first=state.musicPlayback;await new Promise(r=>setTimeout(r,3000));const later=await call('state');
 const advancing=later.musicPlayback?.playing&&(later.musicPlayback.track!==first?.track||later.musicPlayback.position>first.position);
 assert.ok(advancing,'music advances after deployment');
 const result={running:later.running,connection:later.connection,connectionDetail:later.connectionDetail,collectorHealth:later.collectorHealth,stats:later.stats,draw:{phase:later.drawGame.phase,session:later.drawGame.session,round:later.drawGame.round},turtle:later.turtleGame.phase,waiting:later.songs.length,song:later.currentSong?.title,music:later.musicPlayback,outputs:later.outputWindows,health:later.health,assets,logs:later.logs.slice(-10)};
 await writeFile('output/turtle-deployment-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
