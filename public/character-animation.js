export async function setupEatingAnimation(scene){
  const sprite=scene.querySelector('#eating-sprite');
  if(!sprite)return false;
  try{
    const frames=await Promise.all(['scoop','lift','mouth','bite','chew','smile'].map(async pose=>{
      const frame=new Image();frame.className='eating-hd-frame';frame.dataset.pose=pose;frame.alt='';frame.src=`/eating-hd/${pose}.png`;
      await frame.decode();if(frame.naturalWidth<1000||frame.naturalHeight<1500)throw new Error('HD frame too small');return frame;
    }));
    sprite.replaceChildren(...frames);sprite.style.backgroundImage='none';sprite.classList.add('hd-eating');
    sprite.hidden=false;scene.classList.add('has-eating-animation','has-hd-eating');return true;
  }catch{}
  // If any HD frame fails, retain the complete original six-pose animation.
  const image=new Image();image.src='/whale-eating-v1.png';
  try{
    await image.decode();
    sprite.style.backgroundImage=`url("${image.src}")`;
    sprite.hidden=false;scene.classList.add('has-eating-animation');
    return true;
  }catch{
    // Keep the original character visible if the sprite cannot be loaded.
    return false;
  }
}
