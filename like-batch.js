// Only match standalone platform-style notices, leaving conversations about likes alone.
export function isLikeNotice(text) {
  return /^(?:(?:为|给)(?:主播|本场直播|直播间))?(?:点了赞|点赞了|点赞)[！!。～~\s]*$/u.test(text.trim());
}

export class LikeBatch {
  constructor({windowMs=15000,cooldownMs=45000}={}) {
    this.windowMs=windowMs;this.cooldownMs=cooldownMs;this.reset();
  }
  reset() {this.count=0;this.firstAt=null;this.lastTakenAt=null;}
  add(now=Date.now()) {if(!this.count)this.firstAt=now;this.count++;}
  get readyAt() {
    if(!this.count)return Infinity;
    return Math.max(this.firstAt+this.windowMs,this.lastTakenAt===null?0:this.lastTakenAt+this.cooldownMs);
  }
  take(now=Date.now()) {
    if(now<this.readyAt)return null;
    const count=this.count;this.count=0;this.firstAt=null;this.lastTakenAt=now;
    return {user:'海底点赞团',text:`这段时间收到了${count}条点赞提醒`,likeNotice:{notifications:count}};
  }
}
