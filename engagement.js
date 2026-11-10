// Keep invitations occasional; never let idle chatter turn into a sales loop.
export class Engagement {
 constructor(){this.lastFollow=0;this.quietTurns=0;}
 activity(event){if(event.kind!=='entry'&&event.source==='douyin')this.quietTurns=0;}
 context(event,now=Date.now()){
  const allowed=!event.entryNotice&&!event.hostNotice&&!event.likeNotice&&!event.danceNotice&&!event.songNotice&&(!event.idleNotice||this.quietTurns===0)&&now-this.lastFollow>=10*60*1000;
  return {允许轻提醒关注:allowed,连续主动发言次数:this.quietTurns};
 }
 spoken(text,event,now=Date.now()){
  if(/关注|订阅|点个关|点一下关|点下关/u.test(text))this.lastFollow=now;
  if(event.idleNotice)this.quietTurns++;
 }
 idleSeconds(base,musicPlaying=false){return Math.max(base,musicPlaying?90:45)*Math.min(4,2**this.quietTurns);}
}
