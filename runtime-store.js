import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
// No configuration or credentials are part of this allowlist.
const fields=['running','connection','connectionWanted','comments','songs','failedSongs','currentSong','reply','effect','danceQueue','danceReceipts','lastGift','recentGifts','logs','stats'];
export class RuntimeStore{
 constructor(dir){this.file=path.join(dir,'runtime-state.json');this.writing=Promise.resolve();}
 save(state,room,{clean=false}={}){
  const snapshot={version:1,room,savedAt:Date.now(),clean,state:Object.fromEntries(fields.filter(k=>Object.hasOwn(state,k)).map(k=>[k,state[k]]))};
  const contents=JSON.stringify(snapshot);
  this.writing=this.writing.catch(()=>{}).then(async()=>{await writeFile(this.file+'.tmp',contents,'utf8');await rename(this.file+'.tmp',this.file);});
  return this.writing;
 }
 async load(room,now=Date.now()){
  let saved;try{saved=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(saved.version!==1||saved.room!==room||!Number.isFinite(saved.savedAt)||now-saved.savedAt>86400000||saved.savedAt>now+60000)return null;
  if(!saved.state||!Array.isArray(saved.state.songs)||!Array.isArray(saved.state.danceQueue)||typeof saved.state.running!=='boolean'||!saved.state.stats)return null;
  const state=Object.fromEntries(fields.filter(k=>Object.hasOwn(saved.state,k)).map(k=>[k,saved.state[k]]));
  // An interrupted gift must finish once, without replaying already completed gifts.
  if(state.effect?.giftId&&state.effect.expiresAt>saved.savedAt){
   const order=state.danceQueue.find(g=>g.giftId===state.effect.giftId);
   if(order)order.remaining++;
   else state.danceQueue.unshift({giftId:state.effect.giftId,user:state.effect.user,source:state.effect.source,remaining:1,receivedAt:saved.savedAt});
  }
  state.effect=null;return state;
 }
}
