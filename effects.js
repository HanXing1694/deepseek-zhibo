import {randomUUID} from 'node:crypto';
export const danceEffect={name:'胖胖跳舞',src:'/effects/pangpang-dance.mp4',durationMs:10050};
export function isHostDanceCommand(text,user,hostNickname){return !!hostNickname&&user===hostNickname&&String(text).trim()==='胖胖跳舞';}
export class EffectTrigger {
  constructor({now=Date.now,cooldownMs=20000}={}){this.now=now;this.cooldownMs=cooldownMs;this.lastAt=null;}
  trigger(text,user,{preview=false,gift=false,hostNickname=''}={}){
    const hostCommand=isHostDanceCommand(text,user,hostNickname);
    if(!preview&&!gift&&!hostCommand)return null;
    const startedAt=this.now();
    if(!gift&&this.lastAt!==null&&startedAt-this.lastAt<this.cooldownMs)return null;
    this.lastAt=startedAt;
    return {...danceEffect,id:randomUUID(),user,startedAt,expiresAt:startedAt+danceEffect.durationMs,...(hostCommand?{source:'host'}:{})};
  }
}
