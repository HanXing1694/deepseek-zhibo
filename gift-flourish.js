// Short on-screen reactions for real gifts. They never start the dance or touch the music.
const kinds={
  '小心心':'hearts',
  '玫瑰':'roses','玫瑰花':'roses',
  '大啤酒':'beer','啤酒':'beer',
  '人气票':'tickets',
  '粉丝团灯牌':'lanterns','灯牌':'lanterns',
  '亲吻':'kiss','爱你':'kiss',
};
export function flourishKind(name){
  if(typeof name!=='string')return null;
  const label=name.trim();
  if(!label||label.length>16)return null;
  return kinds[label]||'spark';
}

export class GiftNotices {
  constructor(){this.seen=new Map();}
  accept(gift,{baseline=false}={}){
    if(!gift||flourishKind(gift.name)===null||gift.name==='小心心'||typeof gift.id!=='string'||!gift.id||!gift.user||!Number.isSafeInteger(gift.count)||gift.count<1||gift.count>100000)return 0;
    const previous=this.seen.get(gift.id);
    if(previous&&(previous.user!==gift.user||previous.name!==gift.name))return 0;
    const delta=gift.count-(previous?.count||0);if(delta<=0)return 0;
    this.seen.set(gift.id,{user:gift.user,name:gift.name,count:gift.count});
    if(this.seen.size>5000)this.seen.delete(this.seen.keys().next().value);
    return baseline?0:delta;
  }
}
