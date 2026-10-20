/* The endpoint is public; only the server-issued session grants access to data. */
const CLOUD_DEFAULT_URL='https://script.google.com/macros/s/AKfycbxZFerWiAtXAOqol8-NsqKDtTnDoLE_fdBkSmmw4v6q6HQkZK-OuU5OlUnTL7H_WiQtUg/exec';
const Cloud={url:localStorage.getItem('ymhs-safety-gas-url')||CLOUD_DEFAULT_URL,token:sessionStorage.getItem('ymhs-safety-session')||'',connected:false,revision:0,pending:{},busy:false,paused:false,
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
  try{const auth=await this.api('login',{password});this.token=auth.token;const data=await this.api('list');
   this.connected=true;this.paused=false;this.revision=data.revision;
   const saved=JSON.parse(localStorage.getItem(this.key())||'null');this.pending=saved&&saved.pending||{};
   points=data.points;
   Object.entries(this.pending).forEach(([id,p])=>{const index=points.findIndex(x=>x.id===id);if(index<0)points.push(p);else points[index]=p;});
   selected=points[0]?.id;localStorage.setItem('ymhs-safety-gas-url',url);sessionStorage.setItem('ymhs-safety-session',this.token);this.persist();this.showControls();renderAll();this.status('已連接共用試算表');if(Object.keys(this.pending).length)this.flush();
  }catch(e){this.url=oldUrl;this.token=oldToken;throw e;}
 },
 showControls(){document.querySelector('#cloudRefresh').hidden=!this.connected;document.querySelector('#cloudRetry').hidden=!this.connected;document.querySelector('#cloudImport').hidden=!this.connected;document.querySelector('#cloudBackup').hidden=!this.connected;document.querySelector('#cloudConnect').textContent=this.connected?'重新連接':'連接共用試算表';document.querySelector('#mapStorageNote').textContent=this.connected?'圖釘與改善紀錄共用儲存於試算表；請確認同步狀態顯示完成。':'圖釘暫存於這台裝置；連接共用試算表後可跨裝置存取。';},
 save(point){if(!this.connected)return;if(!point){this.status('未同步：缺少指定圖釘。');return;}const prior=this.pending[point.id];this.pending[point.id]={...point,version:prior?prior.version:point.version||0,syncRequestId:crypto.randomUUID()};this.persist();this.status('正在同步…');if(!this.paused)this.flush();},
 async flush(){
  if(this.busy)return;this.busy=true;this.paused=false;
  try{while(Object.keys(this.pending).length){const id=Object.keys(this.pending)[0],snapshot=this.pending[id],encoded=JSON.stringify(snapshot);const result=await this.api('upsert',{point:snapshot,expectedVersion:snapshot.version||0,requestId:snapshot.syncRequestId});this.revision=result.revision;
    const latest=this.pending[id];if(JSON.stringify(latest)===encoded){delete this.pending[id];const index=points.findIndex(p=>p.id===id);if(index>=0)Object.assign(points[index],result.point);}else if(latest){latest.version=result.point.version;const point=points.find(p=>p.id===id);if(point)point.version=result.point.version;}
    this.persist();}
   this.status('已同步至共用試算表');
  }catch(e){this.paused=true;this.status('未同步：'+e.message);this.persist();}
  finally{this.busy=false;}
 },
 async refresh(){if(this.busy)throw Error('正在同步，請稍後重試。');if(Object.keys(this.pending).length){if(!confirm('尚有未同步或衝突的資料。要下載本機備份，並改為載入共用試算表的最新版本嗎？'))return;this.backup();}const data=await this.api('list');this.pending={};this.paused=false;points=data.points;this.revision=data.revision;selected=points.some(p=>p.id===selected)?selected:points[0]?.id;this.persist();renderAll();this.status('已載入共用資料');},
 async remove(id,password){if(this.busy||Object.keys(this.pending).length)throw Error('請先完成未同步資料，再執行刪除。');const point=points.find(p=>p.id===id);const r=await this.api(id?'delete':'clear',{id,password,expectedVersion:point?.version,expectedRevision:this.revision});this.revision=r.revision;points=points.filter(p=>!r.deleted.includes(p.id));selected=points[0]?.id;this.persist();renderAll();this.status('刪除完成，紀錄已保留於試算表');},
 async importLocal(){if(this.busy||Object.keys(this.pending).length)throw Error('請先完成同步。');const local=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!local.length){alert('這台裝置沒有可匯入的本機圖釘。');return;}if(!confirm(`將這台裝置的 ${local.length} 枚圖釘新增到共用試算表？原本機資料會保留。重複匯入會產生重複圖釘。`))return;local.forEach(p=>{const copy={...p,id:'import-'+crypto.randomUUID(),version:0,syncRequestId:crypto.randomUUID()};points.push(copy);this.pending[copy.id]=copy;});this.persist();renderAll();await this.flush();},
 backup(){const payload={savedAt:new Date().toISOString(),points,pending:this.pending};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='校園安全圖釘備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
document.querySelector('#cloudConnect').onclick=()=>{document.querySelector('#cloudUrl').value=Cloud.url;document.querySelector('#cloudPassword').value='';document.querySelector('#cloudError').textContent='';document.querySelector('#cloudDialog').showModal();};
document.querySelector('#cloudForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter,input=document.querySelector('#cloudPassword');button.disabled=true;let password=input.value;input.value='';try{await Cloud.connect(document.querySelector('#cloudUrl').value.trim(),password);document.querySelector('#cloudDialog').close();}catch(e){document.querySelector('#cloudError').textContent=e.message;}finally{password='';button.disabled=false;}};
document.querySelector('#cloudRefresh').onclick=()=>Cloud.refresh().catch(e=>Cloud.status(e.message));
document.querySelector('#cloudRetry').onclick=()=>Cloud.flush();document.querySelector('#cloudImport').onclick=()=>Cloud.importLocal().catch(e=>Cloud.status(e.message));document.querySelector('#cloudBackup').onclick=()=>Cloud.backup();
Cloud.showControls();
// Reconnect with the session in this tab only; expired sessions require the password again.
(async()=>{if(!Cloud.url||!Cloud.token)return;try{const data=await Cloud.api('list');const saved=JSON.parse(localStorage.getItem(Cloud.key())||'null');Cloud.connected=true;Cloud.revision=data.revision;Cloud.pending=saved?.pending||{};points=data.points;Object.entries(Cloud.pending).forEach(([id,p])=>{const i=points.findIndex(x=>x.id===id);if(i<0)points.push(p);else points[i]=p;});selected=points[0]?.id;Cloud.persist();Cloud.showControls();renderAll();Cloud.status('已連接共用試算表');if(Object.keys(Cloud.pending).length)Cloud.flush();}catch(e){Cloud.status('共用連線未完成：'+e.message);}})();
