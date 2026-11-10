// Deadlines are measured from playback start, never from the next request's arrival.
export function songAdvanceSeconds(seconds,waitingCount) {
  if(waitingCount<1||seconds<=0)return 240;
  return Math.min(240,waitingCount>5?Math.min(seconds,60):seconds);
}
export class SongScheduler {
  constructor(next,{now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
    Object.assign(this,{next,now,setTimer,clearTimer});this.timer=null;this.version=0;
  }
  sync({running,currentSong,waitingCount,seconds}) {
    this.stop();
    seconds=songAdvanceSeconds(seconds,waitingCount);
    if(!running || !currentSong || currentSong.status==='播放结束')return;
    const version=this.version;
    const remaining=Math.max(0,currentSong.startedAt+seconds*1000-this.now());
    this.timer=this.setTimer(()=>{if(version===this.version){this.timer=null;this.next();}},remaining);
  }
  stop(){this.version++;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
}
