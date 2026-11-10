export function hostNicknameFromTitle(title){return String(title).match(/^(.{1,60}?)的抖音直播间(?:\s*[-|｜]|$)/u)?.[1]?.trim()||'';}
export function isHostEntry(event,hostNickname){
  if(!hostNickname||event.user!==hostNickname)return false;
  return isRoomEntry(event);
}
export function isRoomEntry(event){
  if(event.kind==='chat')return false;
  if(event.kind==='entry')return true;
  let text=event.text.trim();
  if(text.startsWith(event.user))text=text.slice(event.user.length).replace(/^[\s：:]+/u,'');
  return /^(?:进入了?直播间|来到了?直播间|来了)[！!。~～\s]*$/u.test(text);
}
export class HostWelcome {
  constructor({now=Date.now,cooldownMs=120000}={}){this.now=now;this.cooldownMs=cooldownMs;this.lastAt=null;this.lastName='';}
  take(event,hostNickname){
    if(!isHostEntry(event,hostNickname))return null;
    const now=this.now();
    if(this.lastName===hostNickname&&this.lastAt!==null&&now-this.lastAt<this.cooldownMs)return null;
    this.lastAt=now;this.lastName=hostNickname;
    return {...event,hostNotice:true};
  }
}
