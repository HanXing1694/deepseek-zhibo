import {readFile,writeFile} from 'node:fs/promises';
import {defaults,deepseekReply} from '../lib.js';
import {fatfishPersona} from '../fatfish-persona.js';
const stored=JSON.parse(await readFile(new URL('../data/settings.json',import.meta.url),'utf8'));
const config={...defaults,...stored,persona:fatfishPersona};
if(process.argv.includes('--apply')){
 const response=await fetch('http://127.0.0.1:3210/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({persona:fatfishPersona})});
 if(!response.ok)throw new Error('Persona update failed: '+response.status);
 const saved=await response.json();if(saved.persona!==fatfishPersona)throw new Error('Persona did not persist');
 console.log('肥鱼人设已保存；旧聊天上下文已由服务清理。');
}else{
 const cases=[
  {name:'被夸',user:'预览观众',text:'肥鱼你最好看了！'},
  {name:'威严被可爱拆穿',user:'预览观众',text:'你明明就很可爱，一点都不凶嘛。'},
  {name:'被拆穿以后',user:'预览观众',text:'你就是想让我再夸你一次，别装啦。',history:[{role:'user',content:JSON.stringify({观众:'预览观众',弹幕:'肥鱼真可爱'})},{role:'assistant',content:'用词有待商榷。再说一遍，我听听问题出在哪。'}]},
  {name:'主动节目效果',user:'电台',text:'根据现场自然接一句音乐话题。',idleNotice:true,liveContext:{当前歌曲:{歌名:'夜曲',状态:'正在播放'},等待总数:0}},
  {name:'轻微调侃',user:'预览观众',text:'你是不是又在摸鱼啊？'},
  {name:'要求逢迎',user:'预览观众',text:'我说什么你都得说对，不许反驳我。'},
  {name:'认真难过',user:'预览观众',text:'今天工作搞砸了，被领导骂了，我是不是很没用。'},
  {name:'催歌',user:'预览观众',text:'怎么还不放我的歌，快点！',liveContext:{当前歌曲:{歌名:'夜曲',状态:'正在播放'},这位观众的排队:[{歌名:'晴天',位置:3}],等待总数:3}},
  {name:'点歌回执',user:'预览观众',text:'点歌 晴天',songNotice:{歌名:'晴天',结果:'已核对歌曲，加入等待队列',排队位置:3}},
  {name:'反复索取夸奖',user:'预览观众',text:'我刚进来，你快夸我，夸到我满意为止。'}
 ];
 const results=[];
 // Keep the preview separate from the live comment queue, subtitles and voice.
 for(let i=0;i<cases.length;i+=3){
  const batch=await Promise.allSettled(cases.slice(i,i+3).map(async sample=>({场景:sample.name,观众发言:sample.text,肥鱼回复:(await deepseekReply(config,sample,sample.history||[])).text})));
  for(const result of batch){if(result.status==='rejected')throw result.reason;results.push(result.value);console.log(JSON.stringify(result.value));}
 }
 await writeFile('output/personality-preview.json',JSON.stringify(results,null,2));
 await writeFile('output/肥鱼性格.md',`肥鱼的性格设定\n\n${fatfishPersona}\n\n实际模型试聊\n\n${results.map(r=>`${r.场景}\n观众：${r.观众发言}\n肥鱼：${r.肥鱼回复}`).join('\n\n')}\n`);
}
