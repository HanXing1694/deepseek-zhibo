import {createHash} from 'node:crypto';
const fingerprint=event=>createHash('sha256').update(JSON.stringify([String(event.user||'').trim(),String(event.text||'').trim()])).digest('hex');
export class CommentReceipts {
 constructor(records,{now=Date.now}={}){this.records=records;this.now=now;this.index=new Map(records.map(r=>[r.key,r]));}
 keys(room,event){const prefix=String(room)+':';return [prefix+'text:'+fingerprint(event),...(event.platformId?[prefix+'id:'+String(event.platformId).slice(0,200)]:[])];}
 remember(room,event,{baseline=false}={}){
  const keys=this.keys(room,event),now=this.now();
  for(const key of keys){const existing=this.index.get(key);if(existing){existing.time=now;existing.baseline=baseline;}else{const record={key,time:now,baseline};this.records.push(record);this.index.set(key,record);}}
  while(this.records.length>10000){const old=this.records.shift();if(this.index.get(old.key)===old)this.index.delete(old.key);}
 }
 accept(room,event){
  const [textKey,idKey]=this.keys(room,event),now=this.now(),text=this.index.get(textKey);
  if(idKey&&this.index.has(idKey))return false;
  // IDs distinguish intentional repeats. Text fallback only covers hydration / DOM clones.
  if(!idKey&&text&&now-text.time<(text.baseline?15000:3000))return false;
  this.remember(room,event);return true;
 }
}
