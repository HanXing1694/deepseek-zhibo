export class EffectPlayback {
  constructor({pause,resume,onStart,onStop,onRelease=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
    Object.assign(this,{pause,resume,onStart,onStop,onRelease,now,setTimer,clearTimer});
    this.version=0;this.busy=false;this.releasing=false;this.active=null;this.pending=null;this.timer=null;
  }
  get locked(){return this.busy||this.releasing||!!this.active;}
  start(effect){
    if(this.locked)return Promise.resolve(false);
    this.busy=true;const version=++this.version;
    this.pending=this.begin(effect,version);return this.pending;
  }
  async begin(effect,version){
    try{
      const token=await this.pause(),pausedAt=this.now();
      if(version!==this.version){await this.resume(token);return false;}
      const startedAt=this.now();effect={...effect,startedAt,expiresAt:startedAt+effect.durationMs};
      this.active={effect,token,pausedAt};this.onStart(effect);
      this.timer=this.setTimer(()=>{this.stop().catch(()=>{});},effect.durationMs);
      return true;
    }finally{this.busy=false;}
  }
  async stop(){
    ++this.version;
    if(this.timer!==null){this.clearTimer(this.timer);this.timer=null;}
    if(!this.active){if(this.busy)await this.pending;return;}
    const active=this.active;this.active=null;this.releasing=true;this.onStop();
    try{await this.resume(active.token);}
    finally{this.releasing=false;this.onRelease(this.now()-active.pausedAt,active.token);}
  }
}
