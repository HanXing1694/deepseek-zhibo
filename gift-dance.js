// One visible platform gift notification becomes one order. Combo updates add only the delta.
export class GiftDanceOrders {
  constructor(queue=[],receipts=[]){this.queue=queue;this.receipts=receipts;this.seen=new Map(receipts.map(receipt=>[receipt.id,receipt]));}
  accept(gift,{baseline=false}={}){
    if(!gift||gift.name!=='小心心'||typeof gift.id!=='string'||!gift.id||!gift.user||!Number.isSafeInteger(gift.count)||gift.count<1||gift.count>100000)return 0;
    const previous=this.seen.get(gift.id);
    if(previous&&(previous.user!==gift.user||previous.name!==gift.name))return 0;
    const delta=gift.count-(previous?.count||0);if(delta<=0)return 0;
    const receipt={id:gift.id,user:gift.user,name:gift.name,count:gift.count};
    this.seen.set(gift.id,receipt);const index=this.receipts.findIndex(item=>item.id===gift.id);
    if(index<0)this.receipts.push(receipt);else this.receipts[index]=receipt;
    if(baseline)return 0;
    const existing=this.queue.find(order=>order.giftId===gift.id);
    if(existing)existing.remaining+=delta;
    else this.queue.push({giftId:gift.id,user:gift.user,source:gift.source||'gift',remaining:delta,receivedAt:Date.now()});
    return delta;
  }
  peek(){return this.queue.find(order=>order.remaining>0)||null;}
  consume(){const order=this.peek();if(!order)return;order.remaining--;if(!order.remaining)this.queue.splice(this.queue.indexOf(order),1);}
  get count(){return this.queue.reduce((sum,order)=>sum+order.remaining,0);}
}

