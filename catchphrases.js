export const catchphrases = Object.freeze([
 '不急不急，小鲸陪你慢慢待着。',
 '你忙你的，我在这儿陪着。',
 '嘿嘿，偷偷冒个泡。',
 '今天也要给自己留一点发呆时间。',
 '让我想想……算了，先开心一会儿。',
 '生活偶尔卡一下，就当是在缓冲快乐。',
 '小鲸电量充足，还能继续陪。',
 '路过也好，坐坐也好，都欢迎。',
 '有时候什么都不干，也挺舒服的。',
 '好啦，肩膀放松一点，别绷着。',
 '这会儿适合放空，也适合听歌。',
 '我先安静三秒……三秒到了，嘿嘿。',
 '别看我话多，我也很会陪人发呆。',
 '快乐不用太大，一点点也算。',
 '你不用接话，听我碎碎念就好。'
]);
// Shuffle a whole round, avoiding a repeat across round boundaries too.
export class CatchphraseBag {
 constructor(random=Math.random){this.random=random;this.remaining=[];this.last=null;}
 next(){
  if(!this.remaining.length){
   this.remaining=[...catchphrases];
   for(let i=this.remaining.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.remaining[i],this.remaining[j]]=[this.remaining[j],this.remaining[i]];}
   if(this.remaining.at(-1)===this.last)[this.remaining[0],this.remaining[this.remaining.length-1]]=[this.remaining.at(-1),this.remaining[0]];
  }
  return this.last=this.remaining.pop();
 }
}
export function hasAudience(state,now=Date.now(),activityWindowMs=60000){
 const sample=state.audience;
 if(sample&&now-sample.time<15000&&Number.isFinite(sample.count))return sample.count>0;
 // Some room layouts omit online counts. Only recent real interaction counts
 // as evidence; historical chat baselines and test messages never qualify.
 return (state.comments||[]).some(e=>e.source==='douyin'&&now-e.time>=0&&now-e.time<activityWindowMs);
}
