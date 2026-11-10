export function gameHostCueValid(reply,state,now=Date.now()){
 if(reply.kind==='program'){return !!state.running&&!!state.program?.enabled&&state.program.pendingSpeech?.id===reply.id;}
 if(reply.kind==='turtle'){const g=state.turtleGame;return !!state.running&&!!g&&!g.paused&&g.phase!=='off'&&g.pendingSpeech?.id===reply.id&&g.gameId===reply.turtleCue?.gameId;}
 if(reply.kind!=='game-host')return true;
 const g=state.drawGame,c=reply.gameCue;
 if(!state.running||!g||g.paused||!c||now>=reply.expiresAt||g.gameId!==c.gameId)return false;
 if(c.stage==='ready')return g.phase==='ready';
 return g.phase==='drawing'&&g.sessionId===c.sessionId&&g.round===c.round&&(c.stage==='reveal'?g.revealed:!g.revealed);
}
