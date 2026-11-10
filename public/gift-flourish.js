const kinds=new Set(['hearts','roses','beer','tickets','lanterns','kiss','spark']);
export function mountGiftFlourish(scene){
  const layer=document.createElement('div');
  layer.className='gift-flourish';layer.hidden=true;layer.setAttribute('aria-hidden','true');
  scene.append(layer);
  let timer,token=0;
  return function play(event){
    if(!event||!kinds.has(event.kind)||typeof event.user!=='string'||typeof event.name!=='string')return;
    const count=Number(event.count);
    if(!Number.isSafeInteger(count)||count<1)return;
    const id=++token;layer.hidden=false;layer.dataset.kind=event.kind;layer.replaceChildren();
    const banner=document.createElement('div');banner.className='gift-banner';
    banner.textContent=`${event.user.slice(0,20)} 送出 ${event.name.slice(0,16)} ×${count}`;
    layer.append(banner);
    const bits=event.kind==='kiss'?9:Math.min(26,12+Math.min(count,12));
    for(let i=0;i<bits;i++){
      const bit=document.createElement('i');
      bit.style.setProperty('--x',`${6+Math.random()*88}%`);
      bit.style.setProperty('--d',`${(Math.random()*0.7).toFixed(2)}s`);
      bit.style.setProperty('--s',(0.75+Math.random()*0.9).toFixed(2));
      layer.append(bit);
    }
    clearTimeout(timer);timer=setTimeout(()=>{if(token===id)layer.hidden=true;},3800);
  };
}
