import {readFile,writeFile} from 'node:fs/promises';
import {deepseekReply,defaults} from '../lib.js';
import {Engagement} from '../engagement.js';
const config={...defaults,...JSON.parse(await readFile(new URL('../data/settings.json',import.meta.url),'utf8'))};
const samples=[
 {name:'自然接话',text:'今天终于把项目做完了，过来歇会儿'},
 {name:'喜欢直播间',text:'这里听歌聊天挺舒服的，以后还想来'},
 {name:'情绪低落',text:'今天被领导骂了，有点难受'},
 {name:'冷场开启话题',text:'结合现场开启一个轻松话题',idleNotice:true,liveContext:{当前歌曲:{歌名:'夜曲',状态:'正在播放'}}},
 {name:'冷场无人接话',text:'结合现场自然接一句',idleNotice:true,engagement:{允许轻提醒关注:false,连续主动发言次数:2}}
];
const engagement=new Engagement();
const results=await Promise.all(samples.map(async sample=>({场景:sample.name,回复:(await deepseekReply(config,{user:'预览观众',...sample,engagement:sample.engagement||engagement.context(sample)},[])).text})));
await writeFile('output/engagement-preview.json',JSON.stringify(results,null,2));
for(const result of results)console.log(JSON.stringify(result));
