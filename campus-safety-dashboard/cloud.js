/* Save directly; every shared-data read and deletion requires the password. */
const CLOUD_DEFAULT_URL='https://script.google.com/macros/s/AKfycbxZFerWiAtXAOqol8-NsqKDtTnDoLE_fdBkSmmw4v6q6HQkZK-OuU5OlUnTL7H_WiQtUg/exec';
const Cloud={url:localStorage.getItem('ymhs-safety-gas-url')||CLOUD_DEFAULT_URL,token:sessionStorage.getItem('ymhs-safety-session')||'',connected:true,revision:0,pending:{},busy:false,paused:false,
 key(){return 'ymhs-safety-cloud:'+this.url;},
 status(text){document.querySelector('#cloudStatus').textContent=text;},
 persist(){localStorage.setItem(this.key(),JSON.stringify({points,pending:this.pending}));},
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
   selected=points[0]?.id;localStorage.setItem('ymhs-safety-gas-url',url);sessionStorage.removeItem('ymhs-safety-session');this.persist();this.showControls();renderAll();this.status('已驗證密碼並讀取共用資料；儲存不需密碼');if(Object.keys(this.pending).length)this.flush();
  }catch(e){this.url=oldUrl;this.token=oldToken;throw e;}
 },
 showControls(){document.querySelector('#cloudRefresh').hidden=true;document.querySelector('#cloudRetry').hidden=!this.connected;document.querySelector('#cloudImport').hidden=!this.connected;document.querySelector('#cloudBackup').hidden=!this.connected;document.querySelector('#cloudConnect').textContent='讀取共用資料（需密碼）';document.querySelector('#mapStorageNote').textContent=this.connected?'新增與儲存直接同步試算表；讀取共用資料、刪除及清除需管理密碼。':'圖釘暫存於這台裝置；連接共用試算表後可跨裝置存取。';},
 save(point){if(!this.connected)return;if(!point){this.status('未同步：缺少指定圖釘。');return;}const prior=this.pending[point.id];this.pending[point.id]={...point,version:prior?prior.version:point.version||0,syncRequestId:crypto.randomUUID()};this.persist();this.status('正在同步…');if(!this.paused)this.flush();},
 async flush(){
  if(this.busy)return;this.busy=true;this.paused=false;
  try{while(Object.keys(this.pending).length){const id=Object.keys(this.pending)[0],snapshot=this.pending[id],encoded=JSON.stringify(snapshot);const result=await this.api('upsert',{point:snapshot,expectedVersion:snapshot.version||0,requestId:snapshot.syncRequestId});this.revision=result.revision;
    const latest=this.pending[id];if(JSON.stringify(latest)===encoded){delete this.pending[id];const index=points.findIndex(p=>p.id===id);if(index>=0)Object.assign(points[index],result.receipt);}else if(latest){latest.version=result.receipt.version;const point=points.find(p=>p.id===id);if(point)point.version=result.receipt.version;}
    this.persist();}
   this.status('已同步至共用試算表');
  }catch(e){this.paused=true;this.status('未同步：'+e.message);this.persist();}
  finally{this.busy=false;}
 },
 async refresh(){document.querySelector('#cloudConnect').click();},
 async remove(id,password){if(this.busy||Object.keys(this.pending).length)throw Error('請先完成未同步資料，再執行刪除。');const point=points.find(p=>p.id===id);const r=await this.api(id?'delete':'clear',{id,password,expectedVersion:point?.version,expectedRevision:this.revision});this.revision=r.revision;points=points.filter(p=>!r.deleted.includes(p.id));selected=points[0]?.id;this.persist();renderAll();this.status('刪除完成，紀錄已保留於試算表');},
 async importLocal(){if(this.busy||Object.keys(this.pending).length)throw Error('請先完成同步。');const local=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!local.length){alert('這台裝置沒有可匯入的本機圖釘。');return;}if(!confirm(`將這台裝置的 ${local.length} 枚圖釘新增到共用試算表？原本機資料會保留。重複匯入會產生重複圖釘。`))return;local.forEach(p=>{const copy={...p,id:'import-'+crypto.randomUUID(),version:0,syncRequestId:crypto.randomUUID()};points.push(copy);this.pending[copy.id]=copy;});this.persist();renderAll();await this.flush();},
 backup(){const payload={savedAt:new Date().toISOString(),points,pending:this.pending};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='校園安全圖釘備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
document.querySelector('#cloudConnect').onclick=()=>{document.querySelector('#cloudUrl').value=Cloud.url;document.querySelector('#cloudPassword').value='';document.querySelector('#cloudError').textContent='';document.querySelector('#cloudDialog').showModal();};
document.querySelector('#cloudForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter,input=document.querySelector('#cloudPassword');button.disabled=true;let password=input.value;input.value='';try{await Cloud.connect(document.querySelector('#cloudUrl').value.trim(),password);document.querySelector('#cloudDialog').close();}catch(e){document.querySelector('#cloudError').textContent=e.message;}finally{password='';button.disabled=false;}};
document.querySelector('#cloudRefresh').onclick=()=>Cloud.refresh().catch(e=>Cloud.status(e.message));
document.querySelector('#cloudRetry').onclick=()=>Cloud.flush();document.querySelector('#cloudImport').onclick=()=>Cloud.importLocal().catch(e=>Cloud.status(e.message));document.querySelector('#cloudBackup').onclick=()=>Cloud.backup();
Cloud.showControls();
// Do not automatically read protected records on page load, even with an old session.
sessionStorage.removeItem('ymhs-safety-session');
const pendingDraft=JSON.parse(localStorage.getItem(Cloud.key())||'null');
Cloud.pending=pendingDraft?.pending||{};
Object.values(Cloud.pending).forEach(p=>{const i=points.findIndex(x=>x.id===p.id);if(i<0)points.push(p);else points[i]=p;});
Cloud.status('可直接儲存；讀取共用資料時請輸入密碼');
if(Object.keys(Cloud.pending).length){renderAll();Cloud.flush();}
