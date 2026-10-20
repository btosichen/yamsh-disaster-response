/* Shared markers are public; full records and deletion require the password. */
const CLOUD_DEFAULT_URL='https://script.google.com/macros/s/AKfycbxZFerWiAtXAOqol8-NsqKDtTnDoLE_fdBkSmmw4v6q6HQkZK-OuU5OlUnTL7H_WiQtUg/exec';
const Cloud={url:localStorage.getItem('ymhs-safety-gas-url')||CLOUD_DEFAULT_URL,token:sessionStorage.getItem('ymhs-safety-session')||'',connected:true,revision:0,pending:{},busy:false,paused:false,loadingPublic:false,formDirty:false,readSelection:null,knownSharedIds:new Set(),
 key(){return 'ymhs-safety-cloud:'+this.url;},
 status(text){document.querySelector('#cloudStatus').textContent=text;},
 persist(){localStorage.setItem(this.key(),JSON.stringify({points,pending:this.pending,knownSharedIds:[...this.knownSharedIds]}));},
 async api(action,data={}){
  if(!this.url)throw Error('請先設定共用試算表連線。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:this.token,...data}),signal:controller.signal,redirect:'follow',credentials:'omit'});const result=await response.json();if(!result.ok){const err=Error(result.code==='NOT_INSTALLED'?'Google 端尚未完成管理密碼設定，請先完成試算表的初始化視窗。':result.error||'無法完成操作。');err.code=result.code;throw err;}return result;}
  catch(e){if(e.name==='AbortError')throw Error('連線逾時；資料保留在本機，請按重試同步。');throw e;}
  finally{clearTimeout(timer);}
 },
 async connect(url,password){
  if(this.busy)throw Error('正在同步，請稍後再連接。');if(this.connected&&url!==this.url&&Object.keys(this.pending).length)throw Error('尚有未同步資料，請先完成同步或備份，才能切換網址。');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw Error('請貼上 Apps Script 部署後以 /exec 結尾的網址。');
  const oldUrl=this.url,oldToken=this.token;this.url=url;
  try{const data=await this.api('list',{password});
   this.connected=true;this.paused=false;this.revision=data.revision;
   if(Object.keys(this.pending).length){if(!confirm('尚有未同步或衝突的資料。是否下載備份後，改為載入共用資料？'))return;this.backup();}this.pending={};
   points=data.points;
   Object.entries(this.pending).forEach(([id,p])=>{const index=points.findIndex(x=>x.id===id);if(index<0)points.push(p);else points[index]=p;});
   selected=points.some(p=>p.id===this.readSelection)?this.readSelection:points[0]?.id;this.readSelection=null;points.forEach(p=>this.knownSharedIds.add(p.id));localStorage.setItem('ymhs-safety-gas-url',url);sessionStorage.removeItem('ymhs-safety-session');this.persist();this.showControls();renderAll();this.status('已驗證密碼並讀取共用資料；儲存不需密碼');if(Object.keys(this.pending).length)this.flush();
  }catch(e){this.url=oldUrl;this.token=oldToken;throw e;}
 },
 showControls(){document.querySelector('#cloudRefresh').hidden=false;document.querySelector('#cloudRetry').hidden=!this.connected;document.querySelector('#cloudImport').hidden=!this.connected;document.querySelector('#cloudBackup').hidden=!this.connected;document.querySelector('#cloudConnect').textContent='完整改善紀錄（需密碼）';document.querySelector('#mapStorageNote').textContent=this.connected?'共用圖釘自動顯示，約每30秒更新；完整紀錄與刪除仍需管理密碼。':'圖釘暫存於這台裝置；連接共用試算表後可跨裝置存取。';},
 save(point){this.formDirty=false;if(!this.connected)return;if(!point){this.status('未同步：缺少指定圖釘。');return;}const prior=this.pending[point.id];this.pending[point.id]={...point,version:prior?prior.version:point.version||0,syncRequestId:crypto.randomUUID()};this.persist();this.status('正在同步…');if(!this.paused)this.flush();},
 async flush(){
  if(this.busy)return;this.busy=true;this.paused=false;
  try{while(Object.keys(this.pending).length){const id=Object.keys(this.pending)[0],snapshot=this.pending[id],encoded=JSON.stringify(snapshot);const result=await this.api('upsert',{point:snapshot,expectedVersion:snapshot.version||0,requestId:snapshot.syncRequestId});this.revision=result.revision;
    const latest=this.pending[id];if(JSON.stringify(latest)===encoded){delete this.pending[id];const index=points.findIndex(p=>p.id===id);if(index>=0)Object.assign(points[index],result.receipt);}else if(latest){latest.version=result.receipt.version;const point=points.find(p=>p.id===id);if(point)point.version=result.receipt.version;}
    this.persist();}
   this.status('已同步至共用試算表');
  }catch(e){this.paused=true;this.status('未同步：'+e.message);this.persist();}
  finally{this.busy=false;}
 },
 async refresh(){return this.refreshPublic(true);},
 async refreshPublic(manual=false){
  if(this.loadingPublic||this.busy||Object.keys(this.pending).length||this.formDirty||dragging||addMode||editMode||document.querySelector('dialog[open]')){if(manual)this.status('請先完成目前的編輯或同步，再更新共用圖釘。');return;}
  this.loadingPublic=true;
  try{
   const data=await this.api('publicList');
   if(this.busy||Object.keys(this.pending).length||this.formDirty||dragging||addMode||editMode||document.querySelector('dialog[open]'))return;
   const incoming=new Map(data.points.map(p=>[p.id,p]));
   points=points.filter(p=>incoming.has(p.id)||(!p.publicOnly&&!p.version&&!this.knownSharedIds.has(p.id)));
   const current=new Map(points.map(p=>[p.id,p]));
   for(const p of data.points){const existing=current.get(p.id);if(!existing)points.push(p);else if(existing.publicOnly)Object.assign(existing,p);else if(Number(existing.version||0)!==p.version){for(const key of Object.keys(existing))delete existing[key];Object.assign(existing,p);}this.knownSharedIds.add(p.id);}
   this.revision=data.revision;selected=points.some(p=>p.id===selected)?selected:undefined;this.persist();renderAll();this.status(`共用圖釘已更新（${data.points.length} 枚）；新增後請確認同步完成`);
  }catch(e){this.status('暫時無法更新共用圖釘：'+e.message);}
  finally{this.loadingPublic=false;}
 },
 forgetDeleted(ids){
  const removed=new Set(ids);points=points.filter(p=>!removed.has(p.id));
  // Remove matching legacy local copies too, so a page reload cannot resurrect a pin.
  const local=JSON.parse(localStorage.getItem(storageKey)||'[]');
  localStorage.setItem(storageKey,JSON.stringify(local.filter(p=>!removed.has(p.id))));
  selected=points.some(p=>p.id===selected)?selected:points[0]?.id;this.persist();renderAll();
 },
 async remove(id,password){
  if(this.busy||Object.keys(this.pending).length)throw Error('請先完成未同步資料，再執行刪除。');
  const localPoint=points.find(p=>p.id===id),localIds=points.map(p=>p.id),previousRevision=this.revision;
  // The password authorizes this read; never use a stale local version for deletion.
  const latest=await this.api('list',{password});this.revision=latest.revision;
  const current=latest.points.find(p=>p.id===id);
  if(id&&!current){this.forgetDeleted([id]);this.status('共用資料已無此圖釘，已移除本機舊圖釘');return;}
  if(id&&Number(localPoint?.version||0)!==current.version){
   if(localPoint)Object.assign(localPoint,current);this.persist();renderAll();
   if(!confirm(`這枚圖釘有較新的紀錄：${current.title}\n更新時間：${current.updatedAt||'未提供'}\n是否刪除這枚圖釘的最新版本及改善紀錄？`))throw Error('已載入這枚圖釘的最新紀錄，取消刪除。');
  }
  if(!id&&previousRevision!==latest.revision&&!confirm(`共用資料已有更新，目前共有 ${latest.points.length} 枚圖釘。確定清除所有圖釘及其改善紀錄嗎？`))throw Error('共用資料已有更新，已取消清除。');
  try{
   const r=await this.api(id?'delete':'clear',{id,password,expectedVersion:current?.version,expectedRevision:latest.revision});this.revision=r.revision;
   this.forgetDeleted(id?[id]:[...localIds,...r.deleted]);this.status('刪除完成，紀錄已保留於試算表');
  }catch(e){if(e.code==='CONFLICT')throw Error('確認期間資料再次更新，尚未刪除。請再按「驗證並刪除」，系統會重新取得最新紀錄。');throw e;}
 },
 async importLocal(){if(this.busy||Object.keys(this.pending).length)throw Error('請先完成同步。');const local=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!local.length){alert('這台裝置沒有可匯入的本機圖釘。');return;}if(!confirm(`將這台裝置的 ${local.length} 枚圖釘新增到共用試算表？原本機資料會保留。重複匯入會產生重複圖釘。`))return;local.forEach(p=>{const copy={...p,id:'import-'+crypto.randomUUID(),version:0,syncRequestId:crypto.randomUUID()};points.push(copy);this.pending[copy.id]=copy;});this.persist();renderAll();await this.flush();},
 backup(){const payload={savedAt:new Date().toISOString(),points,pending:this.pending};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='校園安全圖釘備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
document.querySelector('#cloudConnect').onclick=()=>{document.querySelector('#cloudUrl').value=Cloud.url;document.querySelector('#cloudPassword').value='';document.querySelector('#cloudError').textContent='';document.querySelector('#cloudDialog').showModal();};
document.querySelector('#cloudForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter,input=document.querySelector('#cloudPassword');button.disabled=true;let password=input.value;input.value='';try{await Cloud.connect(document.querySelector('#cloudUrl').value.trim(),password);document.querySelector('#cloudDialog').close();}catch(e){document.querySelector('#cloudError').textContent=e.message;}finally{password='';button.disabled=false;}};
document.querySelector('#cloudRefresh').onclick=()=>Cloud.refresh().catch(e=>Cloud.status(e.message));
document.querySelector('#cloudRetry').onclick=()=>Cloud.flush();document.querySelector('#cloudImport').onclick=()=>Cloud.importLocal().catch(e=>Cloud.status(e.message));document.querySelector('#cloudBackup').onclick=()=>Cloud.backup();
Cloud.showControls();
// Only the redacted marker projection is loaded without a password.

sessionStorage.removeItem('ymhs-safety-session');
const pendingDraft=JSON.parse(localStorage.getItem(Cloud.key())||'null');
Cloud.pending=pendingDraft?.pending||{};Cloud.knownSharedIds=new Set(pendingDraft?.knownSharedIds||[]);
Object.values(Cloud.pending).forEach(p=>{const i=points.findIndex(x=>x.id===p.id);if(i<0)points.push(p);else points[i]=p;});
Cloud.status('正在載入共用圖釘…');
if(Object.keys(Cloud.pending).length){renderAll();Cloud.flush().then(()=>Cloud.refreshPublic());}else Cloud.refreshPublic();
setInterval(()=>{if(!document.hidden)Cloud.refreshPublic();},30000);
window.addEventListener('focus',()=>Cloud.refreshPublic());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)Cloud.refreshPublic();});
document.addEventListener('input',event=>{if(event.target.closest('#pinRecordForm'))Cloud.formDirty=true;});
