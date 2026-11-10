export function collectorHealth(sample,now=Date.now()){
 if(!sample)return {status:'unresponsive',detail:'采集脚本暂未响应',recover:true};
 if(sample.verification)return {status:'verification',detail:'直播间需要人工完成验证，自动刷新已暂停',recover:false};
 if(sample.login)return {status:'login',detail:'直播间登录已失效，请在原采集窗口登录',recover:false};
 if(sample.error)return {status:'selector-error',detail:'弹幕选择器无效，请调整高级设置',recover:false};
 if(!sample.observing||(!sample.responsive&&now-sample.heartbeat>30000))return {status:'unresponsive',detail:'采集心跳超时，正在准备恢复',recover:true};
 if(!sample.ready)return {status:'loading',detail:'正在建立历史消息基线',recover:false};
 if(!sample.nodes)return {status:'no-nodes',detail:'采集脚本在线，暂无弹幕节点；请确认直播状态与选择器',recover:false};
 if(now-sample.heartbeat>30000)return {status:'delayed',detail:'采集页面可响应，后台心跳计时延迟',recover:false};
 return {status:'healthy',detail:'采集心跳正常',recover:false};
}
