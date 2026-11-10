export async function setupRoamingCat(scene){
  const image=new Image();image.src='/silver-kitten-v1.png';
  try{await image.decode();}catch{return null;}
  const cat=document.createElement('div');cat.className='roaming-cat';cat.setAttribute('aria-hidden','true');
  const facing=document.createElement('div');facing.className='cat-facing';
  const sprite=document.createElement('div');sprite.className='cat-sprite';sprite.style.backgroundImage=`url("${image.src}")`;
  facing.append(sprite);cat.append(facing);scene.append(cat);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let current={x:0,y:0},animation=null,timer=null,destroyed=false;
  const enabled=()=>!destroyed&&!reduced.matches&&!document.body.classList.contains('motion-paused');
  const bounds=()=>({width:scene.clientWidth,height:scene.clientHeight,size:cat.getBoundingClientRect().width});
  const clamp=(value,max)=>Math.min(Math.max(0,value),Math.max(0,max));
  function place(point){const box=bounds();current={x:clamp(point.x,box.width-box.size),y:clamp(point.y,box.height-box.size)};cat.style.transform=`translate(${current.x}px,${current.y}px)`;}
  function rest(){if(!enabled())return;cat.classList.remove('is-walking');cat.dataset.play=['pounce','groom','look'][Math.floor(Math.random()*3)];timer=setTimeout(move,3500+Math.random()*3000);}
  async function move(){
    if(!enabled())return;
    const box=bounds();const target={x:Math.random()*Math.max(0,box.width-box.size),y:Math.random()*Math.max(0,box.height-box.size)};
    if(Math.hypot(target.x-current.x,target.y-current.y)<box.width*.12){target.x=current.x<box.width/2?box.width-box.size:0;}
    facing.style.transform=target.x<current.x?'scaleX(-1)':'scaleX(1)';cat.classList.add('is-walking');cat.dataset.play='walk';
    const middle={x:(current.x+target.x)/2,y:clamp((current.y+target.y)/2-box.size*.6,box.height-box.size)};
    animation=cat.animate([{transform:`translate(${current.x}px,${current.y}px)`},{transform:`translate(${middle.x}px,${middle.y}px)`,offset:.5},{transform:`translate(${target.x}px,${target.y}px)`}],{duration:3500+Math.random()*2500,easing:'ease-in-out',fill:'forwards'});
    const moving=animation;
    try{await moving.finished;}catch{return;}
    if(animation!==moving||destroyed)return;
    place(target);moving.cancel();animation=null;rest();
  }
  function pause(){
    clearTimeout(timer);timer=null;
    if(animation){const matrix=new DOMMatrix(getComputedStyle(cat).transform);current={x:matrix.m41,y:matrix.m42};animation.cancel();animation=null;place(current);}
    cat.classList.remove('is-walking');
  }
  function sync(){pause();if(enabled())rest();}
  const box=bounds();place({x:box.width*.7,y:box.height*.77});rest();
  const bodyObserver=new MutationObserver(sync);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const resize=new ResizeObserver(()=>{pause();place(current);if(enabled())rest();});resize.observe(scene);
  reduced.addEventListener('change',sync);
  return {element:cat,destroy(){destroyed=true;pause();bodyObserver.disconnect();resize.disconnect();reduced.removeEventListener('change',sync);cat.remove();}};
}
