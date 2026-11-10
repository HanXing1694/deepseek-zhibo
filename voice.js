export const voicePresets = {
  cute: { name: '可爱少女 · 晓伊', voice: 'zh-CN-XiaoyiNeural', pitch: '+35Hz' },
  soft: { name: '温柔甜声 · 晓晓', voice: 'zh-CN-XiaoxiaoNeural', pitch: '+15Hz' }
};
export function escapeSpeech(text) {
  return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
export async function synthesizeVoice(text, {preset='cute',rate=1.05} = {}) {
  if(typeof text!=='string' || !text.trim() || text.length>500) throw new Error('语音文字需为1–500字');
  if(!Object.hasOwn(voicePresets,preset)) throw new Error('请选择有效的音色');
  if(typeof rate!=='number' || !Number.isFinite(rate) || rate<0.5 || rate>2) throw new Error('语速需在0.5–2之间');
  throw new Error('在线语音已移除');
}
