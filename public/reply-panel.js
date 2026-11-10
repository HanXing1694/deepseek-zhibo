export class ReplyPanelTimer {
  constructor({show,hide,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),delay=5000}){
    Object.assign(this,{show,hide,setTimer,clearTimer,delay});this.id=null;this.timer=null;
  }
  clear(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  schedule(id,delay){this.clear();this.timer=this.setTimer(()=>{if(this.id===id){this.timer=null;this.hide();}},delay);}
  newReply(id){if(id===this.id)return;this.id=id;this.show();this.schedule(id,this.delay);}
  pending(id){if(id!==this.id)return;this.show();this.schedule(id,50000);}
  speaking(id){if(id!==this.id)return;this.show();this.schedule(id,180000);}
  ended(id){if(id===this.id)this.schedule(id,this.delay);}
  dispose(){this.clear();this.id=null;}
}
