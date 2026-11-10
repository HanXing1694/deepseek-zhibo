const priority=reply=>reply.kind==='program'?7:reply.kind==='game'?6:reply.kind==='game-host'?(reply.gameCue?.type==='reveal'?5:4):reply.kind==='song'?3:reply.kind==='host'?2:reply.kind==='chat'?1:0;
export class SpeechQueue{
 constructor({play,onStart=()=>{},onError=()=>{},paused=()=>false,isValid=()=>true,now=Date.now,maxSize=10}){Object.assign(this,{play,onStart,onError,paused,isValid,now,maxSize});this.items=[];this.busy=false;this.version=0;}
 enqueue(reply){
  if(this.items.some(item=>item.reply.id===reply.id)||this.current===reply.id)return;
  if(reply.kind==='game-host')this.items=this.items.filter(item=>item.reply.kind!=='game-host'||(this.isValid(item.reply)&&!(reply.gameCue?.type==='winner'&&item.reply.gameCue?.type==='winner')));
  this.items.push({reply,time:this.now()});
  if(this.items.length>this.maxSize){let index=this.items.findIndex(item=>priority(item.reply)===0);if(index<0)index=0;this.items.splice(index,1);}
  void this.drain();
 }
 clear(){this.items=[];this.version++;}
 async drain(){
  if(this.busy||this.paused())return;
  this.busy=true;const version=this.version;
  try{
   while(this.items.length&&!this.paused()&&version===this.version){
    this.items=this.items.filter(item=>this.isValid(item.reply)&&this.now()-item.time<(priority(item.reply)===0?20000:item.reply.kind==='song'?180000:60000));
    this.items.sort((a,b)=>priority(b.reply)-priority(a.reply)||a.time-b.time);
    const item=this.items.shift();if(!item)break;
    this.current=item.reply.id;this.onStart(item.reply);
    try{await this.play(item.reply);}catch(error){this.onError(error);}
   }
  }finally{this.current=null;this.busy=false;if(this.items.length&&!this.paused())void this.drain();}
 }
}
