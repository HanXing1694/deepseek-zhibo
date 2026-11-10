// Loaded only by the isolated server integration test; never contacts DeepSeek.
globalThis.fetch=async(url,options)=>{
 const payload=JSON.parse(options?.body||'{}');
 if(payload.response_format){
  const event=JSON.parse(payload.messages.at(-1).content);
  if(event.弹幕==='慢一点放晴天')await new Promise(resolve=>setTimeout(resolve,200));
  const query=['帮我放晴天','慢一点放晴天'].includes(event.弹幕)?'晴天':event.弹幕==='有没有周杰伦'?'周杰伦':null;
  const content=JSON.stringify(query?{intent:'song',query,reply:''}:{intent:'chat',query:'',reply:'你好呀，一起听歌聊天吧！'});
  return {ok:true,json:async()=>({choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:12}})};
 }
 return {ok:true,json:async()=>({choices:[{message:{content:'收到，歌曲已加入等待队列。谢谢你用心选歌，把喜欢的音乐分享给大家，这份热情让直播间更有温度。喜欢一起听歌的朋友点个关注呀！'}}],usage:{total_tokens:12}})};
};
