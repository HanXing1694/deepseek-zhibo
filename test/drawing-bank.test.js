import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DrawAndGuess,questions} from '../draw-and-guess.js';

test('800道题答案无跨题冲突，笔画在画板内且足够逐笔绘制',()=>{
 assert.equal(questions.length,800);
 const answers=new Map(),pictures=new Set(),clean=s=>s.normalize('NFKC').replace(/[\s，。！？、,.!?~～]/gu,'').toLowerCase();
 for(const [index,[answer,aliases,strokes]] of questions.entries()){
  assert.ok(answer.length>0&&answer.length<=5,answer);
  for(const value of [answer,...aliases]){
   const key=clean(value);
   assert.ok(!answers.has(key)||answers.get(key)===index,`重复答案：${value}`);answers.set(key,index);
  }
  assert.ok(strokes.length>=1&&strokes.length<=30,`${answer}笔画数量`);
  const picture=JSON.stringify(strokes);assert.ok(!pictures.has(picture),`${answer}重复绘图`);pictures.add(picture);
  for(const stroke of strokes){
   assert.ok(stroke.length>=2,`${answer}空笔画`);
   assert.ok(stroke.some(([x,y])=>Math.hypot(x-stroke[0][0],y-stroke[0][1])>1),`${answer}笔画没有长度`);
   for(const [x,y] of stroke)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=600&&y>=0&&y<=480,`${answer}超出画板：${x},${y}`);
  }
 }
});

test('每道题的标准和同义答案可判分，25秒前不泄露答案，公布后得1分',()=>{
 for(const [index,[answer,aliases,strokes]] of questions.entries()){
  let now=100000;
  const game=new DrawAndGuess({now:()=>now});game.enter();game.start();game.data.deck[0]=index;
  const view=game.view();assert.equal(view.answer,undefined);assert.equal(view.answerLength,[...answer].length);assert.deepEqual(view.strokes,strokes);
  for(const [i,value] of [answer,...new Set(aliases)].entries())assert.equal(game.guess('观众'+i,value),true,`${answer}同义词：${value}`);
  assert.equal(game.guess('错误观众','这是'+answer),false);
  now+=25000;assert.equal(game.view().answer,answer);assert.equal(game.guess('公布后',answer),true);assert.equal(game.data.notice.points,1);assert.equal(game.guess('公布后',answer),false);
 }
});

test('扩充题库保持旧题索引，持久恢复仍是原题且保留积分',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(questions.slice(0,500))).digest('hex'),'49189d4c7686b0c46cc310346899c1bcf13c327ba67b774c457fb61dbb5c0d0d');
 assert.equal(createHash('sha256').update(JSON.stringify(questions.slice(0,300))).digest('hex'),'532acc2d7216c21124d8ac6b054a108b61b115cc31aa855baa9255fd8e49ec1e');
 assert.equal(createHash('sha256').update(JSON.stringify(questions.slice(0,230))).digest('hex'),'afc806b12e5c0393c5152f5dd1a4d3866215b44c6b9a85845674dc4f20e8c0ee');
 assert.equal(createHash('sha256').update(JSON.stringify(questions.slice(0,200))).digest('hex'),'bc04f432fc0a9daa93fb68d4e0561ed7fe3e3f2ba3ded0befc317ebb76c357aa');
 const old=['雨伞','苹果','小猫','房子','太阳','小鱼','自行车','冰淇淋','胡萝卜','火箭','西瓜','花朵','蝴蝶','茶杯','小树','月亮','蘑菇','气球','兔子','乌龟','蜗牛','螃蟹','章鱼','刺猬','企鹅','小鸡','鸭子','大象','长颈鹿','鲸鱼','香蕉','草莓','菠萝','樱桃','葡萄','梨','桃子','蛋糕','披萨','汉堡','棒棒糖','荷包蛋','汽车','公交车','帆船','飞机','火车','闹钟','眼镜','剪刀','钥匙','铅笔','书本','台灯','牙刷','帽子','袜子','背包','雪人','彩虹'];
 assert.deepEqual(questions.slice(0,60).map(q=>q[0]),old);
 for(let index=0;index<500;index++){
  const answer=questions[index][0];
  const now=100000,game=new DrawAndGuess({now:()=>now});game.enter();game.start();game.data.deck[0]=index;game.guess('常客',answer);
  const restored=new DrawAndGuess({now:()=>now+5000,saved:JSON.parse(JSON.stringify(game.snapshot()))});
  assert.equal(restored.answerForHost(),answer);assert.equal(restored.ranking()[0].score,2);assert.equal(restored.view().answer,undefined);
 }
});

test('连续600场整库800题轮换，跨场中途衔接也不重复或漏题',()=>{
 let seed=41;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const game=new DrawAndGuess({random});game.enter();
 let seen=new Set(),cycles=0;
 let previous=[];
 for(let i=0;i<600;i++){
  assert.equal(game.start(),true);const deck=game.data.deck;
  assert.equal(new Set(deck).size,6);assert.ok(deck.every(id=>!previous.includes(id)));
  for(const id of deck){if(seen.size===questions.length){seen=new Set();cycles++;}assert.equal(seen.has(id),false,'整库轮完前不能重出');seen.add(id);}
  previous=[...deck];game.data.phase='settlement';
 }
 assert.equal(cycles,4);assert.equal(seen.size,400);
});

test('重启及退出重进继续原轮换，不向抢答页面公开抽题记录',()=>{
 let game=new DrawAndGuess({random:()=>.999});game.enter();let seen=new Set(),cycles=0;
 for(let session=0;session<134;session++){
  assert.equal(game.start(),true);
  for(const id of game.data.deck){if(seen.size===questions.length){seen=new Set();cycles++;}assert.ok(!seen.has(id));seen.add(id);}
  assert.equal(game.view().used,undefined);assert.equal(game.view().deck,undefined);
  const saved=JSON.parse(JSON.stringify(game.snapshot()));
  game=new DrawAndGuess({random:()=>.999,saved});assert.deepEqual(game.snapshot().used,saved.used);
  if(session%3===0){game.exit();game.enter();}else game.data.phase='settlement';
 }
 assert.equal(cycles,1);assert.equal(seen.size,4);
});

test('旧版本存档保留当前六题，扩充后未出新题进入本轮剩余题库',()=>{
 const original=new DrawAndGuess({random:()=>.999});original.enter();original.start();
 const legacy=JSON.parse(JSON.stringify(original.snapshot()));delete legacy.used;
 const restored=new DrawAndGuess({random:()=>.999,saved:legacy});
 assert.deepEqual(restored.used,legacy.recent);assert.deepEqual(restored.data.deck,legacy.data.deck);
 restored.data.phase='settlement';restored.start();assert.ok(restored.data.deck.every(id=>!legacy.recent.includes(id)));
 const expanded=new DrawAndGuess({random:()=>.999,saved:{data:{phase:'settlement',session:1},recent:[294,295,296,297,298,299],used:Array.from({length:300},(_,i)=>i)}});
 const newQuestions=[];
 for(let i=0;i<34;i++){expanded.start();newQuestions.push(...expanded.data.deck);expanded.data.phase='settlement';}
 assert.equal(new Set(newQuestions.slice(0,200)).size,200);assert.ok(newQuestions.slice(0,200).every(id=>id>=300));
});

test('轮换在一场中途用完时，先取完旧轮剩余题再开新轮，相邻场仍不重复',()=>{
 const game=new DrawAndGuess({random:()=>.999,saved:{data:{phase:'settlement',session:1},recent:[0,1,2,3,4,5],used:Array.from({length:798},(_,i)=>i)}});
 game.start();assert.deepEqual(game.data.deck.slice(0,2),[798,799]);assert.equal(new Set(game.data.deck).size,6);assert.ok(game.data.deck.every(id=>id>=6));
 const newCycle=game.data.deck.slice(2);let previous=[...game.data.deck];
 for(let i=0;i<134;i++){
  const saved=JSON.parse(JSON.stringify(game.snapshot()));const restored=new DrawAndGuess({random:()=>.999,saved});
  game.used=restored.used;game.data.phase='settlement';game.start();
  assert.ok(game.data.deck.every(id=>!previous.includes(id)));newCycle.push(...game.data.deck);previous=[...game.data.deck];
 }
 assert.equal(new Set(newCycle.slice(0,800)).size,800);
});


test('500题现场升级到800题时保留旧轮进度，300道新题全部先出且不漏题',()=>{
 const game=new DrawAndGuess({random:()=>.999,saved:{data:{phase:'settlement',session:83,scores:[]},recent:[494,495,496,497,498,499],used:Array.from({length:500},(_,i)=>i)}});
 const seen=[];
 for(let i=0;i<50;i++){
  assert.equal(game.start(),true);seen.push(...game.data.deck);
  const restored=new DrawAndGuess({random:()=>.999,saved:JSON.parse(JSON.stringify(game.snapshot()))});
  assert.deepEqual(restored.used,game.used);game.data.phase='settlement';
 }
 assert.equal(new Set(seen).size,300);assert.ok(seen.every(i=>i>=500&&i<800));
 assert.equal(game.used.length,800);
});
