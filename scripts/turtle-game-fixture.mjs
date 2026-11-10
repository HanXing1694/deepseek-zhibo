import './draw-game-fixture.mjs';
const previous=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const body=options?.body&&JSON.parse(options.body);
 if(String(url).includes('api.deepseek.com')&&body?.messages?.[0]?.content?.includes('TURTLE_JUDGE')){
  const event=JSON.parse(body.messages.at(-1).content);const answers=event.候选.slice(0,2).map(c=>({id:c.id,verdict:c.kind==='guess'?'已破案':'是',keys:c.kind==='guess'?event.题目.keys.map(k=>k.id):[]}));
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answers})}}],usage:{total_tokens:20}})};
 }
 return previous(url,options);
};
