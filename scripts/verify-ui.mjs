import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1280},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3210');
 await page.locator('#backend-badge').filter({hasText:'本机服务已连接'}).waitFor();
 await page.locator('#character').evaluate(img=>img.decode());
 await page.screenshot({path:'output/workspace.png',fullPage:true});
 await page.locator('#settings-open').click();await page.locator('#settings-dialog').waitFor({state:'visible'});
 await page.locator('[data-tab="qq"]').click();assert.equal(await page.locator('#capture-search').isVisible(),true);
 await page.screenshot({path:'output/settings.png'});
 await page.locator('#settings-close').click();
 await page.locator('#test-text').fill('<script>alert(1)</script>');await page.locator('#test-send').click();
 await page.locator('.comment-text').filter({hasText:'<script>alert(1)</script>'}).waitFor();assert.equal(await page.locator('.comment-body script').count(),0);
 await page.waitForTimeout(400);
 await page.goto('http://127.0.0.1:3210/?stage=1');
 await page.setViewportSize({width:1920,height:1080});await page.locator('#character').evaluate(img=>img.decode());
 assert.equal(await page.locator('#control-panel').isVisible(),false);await page.screenshot({path:'output/stage.png'});
 await page.goto('http://127.0.0.1:3210');await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'output/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('UI passed: settings, pure stage, escaped comments, mobile overflow, no browser errors.');
}finally{await browser.close();}
