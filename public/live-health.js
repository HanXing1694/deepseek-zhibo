export function liveHealth(state,outputs=[],now=Date.now()){
 const health=state.collectorHealth,play=state.musicPlayback,speech=state.speechPlayback;
 const freshOutputs=outputs.filter(o=>now-o.updatedAt<16000),audible=freshOutputs.filter(o=>!o.silent&&o.voiceEnabled&&o.audioReady);
 const messageAt=health?.lastMessageAt||0;
 const age=time=>time?Math.max(0,Math.floor((now-time)/1000)):null;
 const connection=['watching','receiving'].includes(state.connection)&&health?.status==='healthy';
 const advancing=!!play&&!!state.currentSong&&play.track===state.currentSong.id&&play.playing&&now-play.checkedAt<8000&&play.lastAdvancedAt&&now-play.lastAdvancedAt<8000;
 return [
  {name:'直播间连接',level:connection?'ok':'warn',text:connection?'监听就绪':health?.detail||state.connectionDetail||'尚未连接'},
  {name:'最近真实弹幕',level:messageAt?'ok':'neutral',text:messageAt?`${age(messageAt)} 秒前收到`:'本次连接尚未收到'},
  {name:'语音与窗口',level:audible.length>1?'warn':audible.length?'ok':'warn',text:audible.length>1?'多个窗口开启声音，请保留一个':audible.length?(speech?.status==='speaking'&&now-speech.updatedAt<180000?'浏览器正在播报':speech?.status==='ended'?`最近播报结束于 ${age(speech.updatedAt)} 秒前`:'声音窗口已就绪，等待播报'):freshOutputs.length?'声音未激活或窗口已静音':'尚无窗口声音回报'},
  {name:'音乐播放',level:advancing?'ok':state.currentSong?'warn':'neutral',text:advancing?`进度正常 · ${Math.floor(play.position)} 秒${play.ducked?' · 语音期间降低音量':''}`:state.currentSong?(play?.playing?'进度待确认':state.currentSong.status||'等待播放回报'):'等待歌曲'},
  {name:'下一首',level:state.nextSongPreparation?.id===state.songs?.[0]?.id&&state.nextSongPreparation?.status==='failed'?'warn':'neutral',text:!state.songs?.length?'暂无排队':state.nextSongPreparation?.id===state.songs[0].id?({ready:'音频已准备',preparing:'正在准备音频',failed:'准备失败，等待重试'}[state.nextSongPreparation.status]||'等待准备'):'等待准备'}
 ];
}
