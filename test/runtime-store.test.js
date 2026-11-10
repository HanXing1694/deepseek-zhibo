import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RuntimeStore} from '../runtime-store.js';
test('现场原子保存，队列和歌曲进度可恢复，隔离房间及过期现场，不保存密钥',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-runtime-'));
 try{
  const store=new RuntimeStore(dir),state={running:true,connection:'receiving',songs:[{id:'s'}],danceQueue:[],currentSong:{title:'歌',position:42},stats:{songs:1},apiKey:'secret'};
  await Promise.all([store.save(state,'123'),store.save({...state,currentSong:{title:'歌',position:43}},'123')]);
  const restored=await store.load('123');assert.equal(restored.running,true);assert.equal(restored.currentSong.position,43);assert.equal(restored.songs[0].id,'s');
  assert.equal((await readFile(store.file,'utf8')).includes('secret'),false);assert.equal(await store.load('456'),null);assert.equal(await store.load('123',Date.now()+86401000),null);
  await store.save({...state,running:false,connection:'disconnected'},'123');assert.equal((await store.load('123')).running,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('崩溃时中断的礼物只补回一次，已经结束的礼物不重播',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'whale-gift-'));
 try{
  const store=new RuntimeStore(dir),state={running:true,songs:[],stats:{},danceQueue:[{giftId:'g',remaining:2}],effect:{giftId:'g',user:'观众',expiresAt:Date.now()+10000}};
  await store.save(state,'1');const restored=await store.load('1');assert.equal(restored.danceQueue[0].remaining,3);assert.equal(restored.effect,null);
  await store.save(restored,'1');assert.equal((await store.load('1')).danceQueue[0].remaining,3);
  await writeFile(store.file,'{}');assert.equal(await store.load('1'),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
