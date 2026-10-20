const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');const {backend}=require('./gas.test.cjs');
(async()=>{const db=backend(),b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://local.test/**',r=>r.fulfill({path:path.join(__dirname,'..',new URL(r.request().url()).pathname.replace('/campus-safety-dashboard/',''))}));
 const endpoint='https://script.google.com/macros/s/test/exec';let offline=false;
 await page.route(endpoint,r=>offline?r.abort():r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(db.post(JSON.parse(r.request().postData())))}));
 await page.goto('https://local.test/campus-safety-dashboard/index.html');
 await page.evaluate(()=>localStorage.setItem('ymhs-campus-safety-pins-v4',JSON.stringify([{id:'local-old',layer:'space',title:'原本機圖釘',x:20,y:30,status:'amber',custom:true}])));await page.reload();
 await page.click('#cloudConnect');await page.fill('#cloudUrl',endpoint);await page.fill('#cloudPassword','test-password-for-suite');await page.click('#cloudForm [type=submit]');await page.waitForFunction(()=>Cloud.connected);assert.equal(await page.locator('.marker').count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(storageKey)).length),1);
 page.once('dialog',d=>d.accept());await page.click('#cloudImport');await page.waitForFunction(()=>!Cloud.busy&&Object.keys(Cloud.pending).length===0);assert.equal(await page.locator('.marker').count(),1);
 await page.locator('.marker').click();await page.fill('#recordProposer','測試人員');await page.fill('#recordReason','夜間照明不足');await page.click('.save-record');await page.waitForFunction(()=>!Cloud.busy&&Object.keys(Cloud.pending).length===0);
 const token=db.post({action:'login',password:'test-password-for-suite'}).token;let rows=db.post({action:'list',token}).points;assert.equal(rows[0].reason,'夜間照明不足');
 await page.click('#deletePin');await page.fill('#deleteAuthPassword','wrong');await page.click('#deleteAuthForm [type=submit]');await page.waitForFunction(()=>document.querySelector('#deleteAuthError').textContent.includes('不正確'));assert.equal(db.post({action:'list',token}).points.length,1);await page.click('#deleteAuthCancel');
 // Offline saves remain visible and can be retried without overwriting the local-mode backup.
 offline=true;await page.fill('#recordReason','離線修改');await page.click('.save-record');await page.waitForFunction(()=>Cloud.paused);assert.equal(await page.evaluate(()=>Object.keys(Cloud.pending).length),1);offline=false;await page.click('#cloudRetry');await page.waitForFunction(()=>!Cloud.busy&&Object.keys(Cloud.pending).length===0);assert.equal(db.post({action:'list',token}).points[0].reason,'離線修改');
 // A second editor changes the row; stale client must get a conflict, not overwrite it.
 rows=db.post({action:'list',token}).points;db.post({action:'upsert',token,point:{...rows[0],reason:'其他同仁修改'},expectedVersion:rows[0].version,requestId:'other-editor'});
 await page.fill('#recordReason','舊版修改');await page.click('.save-record');await page.waitForFunction(()=>Cloud.paused);assert.equal(db.post({action:'list',token}).points[0].reason,'其他同仁修改');page.once('dialog',d=>d.accept());await page.click('#cloudRefresh');await page.waitForFunction(()=>Object.keys(Cloud.pending).length===0);assert.equal(await page.inputValue('#recordReason'),'其他同仁修改');
 await page.click('#deletePin');await page.fill('#deleteAuthPassword','test-password-for-suite');await page.click('#deleteAuthForm [type=submit]');await page.waitForFunction(()=>!document.querySelector('#deleteAuthDialog').open);assert.equal(db.post({action:'list',token}).points.length,0);assert.equal(await page.locator('.marker').count(),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(storageKey))[0].id),'local-old');
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/campus-safety-cloud-preview.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: 本機備份保留、共用匯入、逐筆儲存、錯密碼、離線重試、多人衝突、備份後重載、伺服器刪除及跨尺寸版面');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
