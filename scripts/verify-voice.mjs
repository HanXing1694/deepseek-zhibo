import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3210');
 await page.locator('#backend-badge').filter({hasText:'本机服务已连接'}).waitFor();
 await page.locator('#settings-open').click();
 assert.equal(await page.locator('select[name="voicePreset"]').inputValue(),'cute');
 await page.locator('#test-voice').click();
 await page.locator('#voice-result').filter({hasText:'正在播放试听'}).waitFor({timeout:40000});
 assert.equal(await page.locator('#scene').evaluate(el=>el.classList.contains('is-speaking')),true);
 await page.locator('#test-voice').click();
 await page.locator('#voice-result').filter({hasText:'正在播放试听'}).waitFor({timeout:40000});
 assert.equal(await page.locator('#scene').evaluate(el=>el.classList.contains('is-speaking')),true);
 await page.locator('#settings-close').click();
 await page.locator('#voice-enable').click();
 assert.equal(await page.locator('#scene').evaluate(el=>el.classList.contains('is-speaking')),false);
 const bad=await page.request.post('http://127.0.0.1:3210/api/tts',{data:{text:'你好',preset:'unknown'}});assert.equal(bad.status(),400);
 assert.deepEqual(errors,[]);
 console.log('Voice UI passed: real audio generated and decoded, repeated preview stays enabled, mute stops audio, invalid voice rejected.');
}finally{await browser.close();}
