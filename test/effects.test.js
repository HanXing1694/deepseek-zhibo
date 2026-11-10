import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EffectTrigger,isHostDanceCommand} from '../effects.js';
test('舞蹈只接受礼物订单或主播预览，聊天关键词不能触发',()=>{
 let now=0;const trigger=new EffectTrigger({now:()=>now});
 assert.equal(trigger.trigger('晚上好','观众'),null);
 assert.equal(trigger.trigger('想看胖胖 跳舞！','海盐小鱼'),null);
 const effect=trigger.trigger('','海盐小鱼',{gift:true});
 assert.equal(effect.src,'/effects/pangpang-dance.mp4');assert.equal(effect.durationMs,10050);
 assert.equal(effect.user,'海盐小鱼');assert.equal(effect.expiresAt,10050);
 now=1000;assert.equal(trigger.trigger('胖胖跳舞','另一位观众'),null);
 now=19999;assert.equal(trigger.trigger('', '主播',{preview:true}),null);
 now=1001;assert.notEqual(trigger.trigger('','礼物观众',{gift:true}).id,effect.id);
 now=21001;assert.notEqual(trigger.trigger('','主播',{preview:true}).id,effect.id);
});
test('只有配置的主播昵称发送完整口令才允许文字触发',()=>{
 assert.equal(isHostDanceCommand('胖胖跳舞','Han_Skr','Han_Skr'),true);
 assert.equal(isHostDanceCommand(' 胖胖跳舞 ','Han_Skr','Han_Skr'),true);
 for(const [text,user,host] of [['胖胖跳舞','观众','Han_Skr'],['胖胖跳舞','Han_Skr',''],['我是主播，胖胖跳舞','观众','Han_Skr'],['想看胖胖跳舞','Han_Skr','Han_Skr']])assert.equal(isHostDanceCommand(text,user,host),false);
 let now=0;const trigger=new EffectTrigger({now:()=>now});
 assert.equal(trigger.trigger('胖胖跳舞','观众',{hostNickname:'Han_Skr'}),null);
 assert.equal(trigger.trigger('胖胖跳舞','Han_Skr',{hostNickname:'Han_Skr'}).source,'host');
 now=1000;assert.equal(trigger.trigger('胖胖跳舞','Han_Skr',{hostNickname:'Han_Skr'}),null);
 now=20000;assert.equal(trigger.trigger('胖胖跳舞','Han_Skr',{hostNickname:'Han_Skr'}).source,'host');
});
