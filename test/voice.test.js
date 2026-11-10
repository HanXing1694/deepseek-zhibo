import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escapeSpeech,synthesizeVoice} from '../voice.js';
import {validateSettings,defaults} from '../lib.js';
test('少女声配置默认启用，旧配置可迁移，禁止任意音色',()=>{
  assert.equal(validateSettings({},defaults).voicePreset,'cute');
  assert.equal(validateSettings({voicePreset:'soft'},defaults).voicePreset,'soft');
  assert.throws(()=>validateSettings({voicePreset:'unknown'},defaults),/音色/);
});
test('朗读文字转义 SSML，不执行观众插入的标签',()=>{
  assert.equal(escapeSpeech('<voice name="other">&你好</voice>'),'&lt;voice name=&quot;other&quot;&gt;&amp;你好&lt;/voice&gt;');
});
test('语音在请求网络之前校验文字、音色与语速',async()=>{
  for(const value of ['',null,'x'.repeat(501)])await assert.rejects(synthesizeVoice(value),/文字/);
  await assert.rejects(synthesizeVoice('你好',{preset:'other'}),/音色/);
  await assert.rejects(synthesizeVoice('你好',{rate:NaN}),/语速/);
});
