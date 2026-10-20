// Store only a salted password verifier; every deletion requires fresh authorization.
const deletionVerifier={salt:'9c5fb8d9fb508c4abaecd927ade337eac5dc090a207e335e',hash:'a91e3694fae4dbb96ca04c2bfbc9742f197c0fc606bab72269e04c5f9b34b37c',iterations:600000};
let deletionPending=false;
async function authorizeDeletion(message, action){
 if(deletionPending)return false;
 deletionPending=true;
 const dialog=document.querySelector('#deleteAuthDialog'),form=document.querySelector('#deleteAuthForm'),input=document.querySelector('#deleteAuthPassword'),error=document.querySelector('#deleteAuthError'),submit=form.querySelector('[type="submit"]');
 document.querySelector('#deleteAuthMessage').textContent=message;
 input.value='';error.textContent='';submit.disabled=false;
 return new Promise(resolve=>{
  let settled=false,verifying=false;
  const finish=allowed=>{if(settled)return;settled=true;input.value='';form.onsubmit=null;dialog.onclose=null;dialog.close();deletionPending=false;resolve(allowed)};
  dialog.onclose=()=>finish(false);dialog.oncancel=event=>{if(verifying)event.preventDefault()};document.querySelector('#deleteAuthCancel').onclick=()=>{if(!verifying)dialog.close()};
  form.onsubmit=async event=>{
   event.preventDefault();submit.disabled=true;verifying=true;error.textContent='';
   let password=input.value;input.value='';
   try{
    if(Cloud.connected){await Cloud.remove(action.id,password);password='';finish(true);return;}
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);password='';
    const salt=Uint8Array.from(deletionVerifier.salt.match(/../g),hex=>parseInt(hex,16));
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:deletionVerifier.iterations,hash:'SHA-256'},material,256);
    if(settled)return;
    const hash=Array.from(new Uint8Array(bits),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(hash===deletionVerifier.hash){finish(true);return}
    error.textContent='密碼不正確，未刪除任何圖釘。';
   }catch(e){if(!settled)error.textContent=e.message||'無法驗證密碼，請重新整理後再試。'}
   finally{password='';verifying=false;if(!settled){submit.disabled=false;input.focus()}}
  };
  dialog.showModal();input.focus();
 });
}
const layers={space:{label:'空間配置',icon:'空',color:'#4f78a8'},management:{label:'空間管理',icon:'管',color:'#7759a6'},security:{label:'保全監控',icon:'守',color:'#264a68'},help:{label:'求救通報',icon:'救',color:'#d94b42'},route:{label:'安全路線',icon:'路',color:'#2b9b68'},light:{label:'照明設備',icon:'光',color:'#e6a23c'},visibility:{label:'可視性與死角',icon:'視',color:'#a14e72'}};
const defaultPoints=[];
const issues=[
 {p:'立即確認',color:'#d94b42',text:'確認監視系統點位、有效範圍與實際死角',owner:'校安中心',date:'待排程'},
 {p:'立即確認',color:'#d94b42',text:'核對現行保全公司與緊急聯絡資料',owner:'總務處',date:'待排程'},
 {p:'排程改善',color:'#e6a23c',text:'建立夜間照度、暗區及緊急照明點位圖',owner:'事務組',date:'本學期'},
 {p:'排程改善',color:'#e6a23c',text:'補建求救設備、廣播及AED精確位置圖',owner:'總務處',date:'本學期'},
 {p:'資料校正',color:'#4f78a8',text:'確認圖面與目前校園配置一致',owner:'總務處',date:'近期'}
];
const storageKey='ymhs-campus-safety-pins-v4';
const clone=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let points=loadPoints(),active=new Set(Object.keys(layers)),zoom=1,selected=points.some(p=>p.id==='map')?'map':points[0]?.id,editMode=false,addMode=false,dragging=null;
const layerList=document.querySelector('#layerList'),markers=document.querySelector('#markers'),detail=document.querySelector('#detailContent'),mapStage=document.querySelector('#mapStage'),pinLayer=document.querySelector('#pinLayer'),addPinButton=document.querySelector('#addPin'),editPinsButton=document.querySelector('#editPins'),pinHint=document.querySelector('#pinHint');
function loadPoints(){try{localStorage.removeItem('ymhs-campus-safety-pins-v2');localStorage.removeItem('ymhs-campus-safety-pins-v3');const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved))return saved;localStorage.setItem(storageKey,'[]');return[]}catch{return[]}}
function savePoints(point){if(typeof Cloud!=='undefined'&&Cloud.connected){Cloud.save(point);return;}localStorage.setItem(storageKey,JSON.stringify(points))}
function renderLayers(){layerList.innerHTML=Object.entries(layers).map(([key,value])=>`<button class="layer-button ${active.has(key)?'':'off'}" data-layer="${key}"><span class="layer-icon" style="--layer:${value.color}">${value.icon}</span>${value.label}<span class="layer-count">${points.filter(p=>p.layer===key).length}</span></button>`).join('');document.querySelectorAll('.layer-button').forEach(button=>button.onclick=()=>{active.has(button.dataset.layer)?active.delete(button.dataset.layer):active.add(button.dataset.layer);renderLayers();renderMarkers()})}
function renderMarkers(){markers.innerHTML=points.map(point=>`<button aria-label="${esc(point.title)}" class="marker ${point.alert?'alert':''} ${point.id===selected?'active':''} ${active.has(point.layer)?'':'hidden'}" data-id="${point.id}" style="--x:${point.x}%;--y:${point.y}%;--color:${layers[point.layer].color}"><span>${layers[point.layer].icon}</span></button>`).join('');document.querySelectorAll('.marker').forEach(marker=>{marker.onclick=event=>{event.stopPropagation();if(!dragging)selectPoint(marker.dataset.id)};marker.onpointerdown=event=>startDrag(event,marker.dataset.id)})}
function selectPoint(id){
 selected=id;const point=points.find(item=>item.id===id);if(!point){detail.innerHTML='<p class="detail-empty">選擇一枚圖釘查看資訊。</p>';return}
 const progress=point.followupStatus||'待確認';
 detail.innerHTML=`<span class="category">${layers[point.layer].label}</span><h3>${esc(point.title)}</h3><dl><div><dt>管理內容</dt><dd>${esc(point.asset)}</dd></div><div><dt>主責單位</dt><dd>${esc(point.owner)}</dd></div><div><dt>盤點說明</dt><dd>${esc(point.note)}</dd></div><div><dt>圖面座標</dt><dd>${point.x.toFixed(1)}% ／ ${point.y.toFixed(1)}%</dd></div></dl><div class="detail-status"><span class="status ${point.status}"></span>${point.status==='green'?'已有制度或資料':point.status==='amber'?'資料待確認或補強':'優先現場確認'}</div><form id="pinRecordForm" class="pin-record"><div class="record-heading"><div><p class="kicker">FOLLOW-UP RECORD</p><h4>提出與改善紀錄</h4></div><span class="record-badge">${esc(progress)}</span></div><label>提出人員<span>必填</span><input id="recordProposer" required value="${esc(point.proposer)}" placeholder="姓名或單位"></label><label>聯絡方式<span>選填</span><input id="recordContact" value="${esc(point.contact)}" placeholder="分機、電話或電子郵件"></label><label>說明理由／現場問題<span>必填</span><textarea id="recordReason" required rows="3" placeholder="例如：夜間照度不足，監視畫面無法辨識人員。">${esc(point.reason)}</textarea></label><label>建議改善方式<span>選填</span><textarea id="recordAction" rows="2" placeholder="例如：增設照明、調整鏡頭或加強巡邏。">${esc(point.action)}</textarea></label><label>處理進度<select id="recordProgress"><option ${progress==='待確認'?'selected':''}>待確認</option><option ${progress==='已通報'?'selected':''}>已通報</option><option ${progress==='改善中'?'selected':''}>改善中</option><option ${progress==='已完成'?'selected':''}>已完成</option></select></label><button class="save-record" type="submit">儲存改善紀錄</button><p class="record-note">${point.updatedAt?`上次更新：${esc(point.updatedAt)}`:'儲存後請確認上方同步狀態；尚未連接試算表時僅存於本機。'}</p></form>${point.custom?'<div class="detail-actions"><button class="delete-pin" id="deletePin">刪除這枚自訂圖釘</button></div>':''}`;
 const form=document.querySelector('#pinRecordForm');form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;point.proposer=document.querySelector('#recordProposer').value.trim();point.contact=document.querySelector('#recordContact').value.trim();point.reason=document.querySelector('#recordReason').value.trim();point.action=document.querySelector('#recordAction').value.trim();point.followupStatus=document.querySelector('#recordProgress').value;point.updatedAt=new Date().toLocaleString('zh-TW',{hour12:false});savePoints(point);selectPoint(id)};
 const deleteButton=document.querySelector('#deletePin');if(deleteButton)deleteButton.onclick=async()=>{if(!await authorizeDeletion('輸入管理密碼，刪除這枚圖釘及其改善紀錄。',{id}))return;if(Cloud.connected)return;points=points.filter(item=>item.id!==id);savePoints();selected=points[0]?.id;renderAll()};renderMarkers()
}
function pointFromEvent(event){const rect=mapStage.getBoundingClientRect();return{x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))}}
function startDrag(event,id){if(!editMode)return;event.preventDefault();event.stopPropagation();dragging=id;event.currentTarget.setPointerCapture?.(event.pointerId);selectPoint(id)}
window.addEventListener('pointermove',event=>{if(!dragging)return;const point=points.find(item=>item.id===dragging);if(!point)return;Object.assign(point,pointFromEvent(event));const marker=document.querySelector(`.marker[data-id="${dragging}"]`);if(marker){marker.style.setProperty('--x',`${point.x}%`);marker.style.setProperty('--y',`${point.y}%`)}});
window.addEventListener('pointerup',()=>{if(!dragging)return;const id=dragging;dragging=null;savePoints(points.find(p=>p.id===id));selectPoint(id);renderLayers()});
mapStage.addEventListener('click',event=>{if(!addMode||event.target.closest('.marker'))return;const layer=pinLayer.value,position=pointFromEvent(event),point={id:`custom-${crypto.randomUUID()}`,layer,title:`自訂${layers[layer].label}圖釘`,...position,status:layer==='visibility'?'red':'amber',owner:'待指定',asset:layers[layer].label,note:'由校安或總務人員新增，請補充現場說明。',custom:true,alert:layer==='visibility'};points.push(point);active.add(layer);savePoints(point);selected=point.id;setAddMode(false);renderAll()});
function setAddMode(value){addMode=value;mapStage.classList.toggle('placing',value);addPinButton.classList.toggle('active',value);addPinButton.textContent=value?'取消新增':'＋ 點圖新增圖釘';pinHint.textContent=value?`請在地圖上點一下，新增「${layers[pinLayer.value].label}」圖釘。`:(editMode?'移動模式已開啟，可拖曳任一圖釘。':'選擇圖層後，可在地圖上新增圖釘。')}
function setEditMode(value){editMode=value;mapStage.classList.toggle('editing',value);editPinsButton.classList.toggle('active',value);editPinsButton.textContent=value?'✓ 移動模式已開啟':'↔ 開啟移動模式';if(value)setAddMode(false);else pinHint.textContent='選擇圖層後，可在地圖上新增圖釘。'}
function setZoom(value){zoom=Math.min(1.5,Math.max(.75,value));mapStage.style.transform=`scale(${zoom})`;document.querySelector('#zoomValue').textContent=Math.round(zoom*100)+'%'}
function renderAll(){renderLayers();renderMarkers();selectPoint(selected)}
pinLayer.innerHTML=Object.entries(layers).map(([key,value])=>`<option value="${key}">${value.icon}　${value.label}</option>`).join('');pinLayer.value='visibility';pinLayer.onchange=()=>{if(addMode)pinHint.textContent=`請在地圖上點一下，新增「${layers[pinLayer.value].label}」圖釘。`};
addPinButton.onclick=()=>setAddMode(!addMode);editPinsButton.onclick=()=>setEditMode(!editMode);
document.querySelector('#resetPins').onclick=async()=>{if(await authorizeDeletion('輸入管理密碼，清除所有圖釘及其改善紀錄。',{id:null})){if(Cloud.connected)return;points=[];savePoints();selected=undefined;active=new Set(Object.keys(layers));renderAll()}};
document.querySelector('#resetLayers').onclick=()=>{Object.keys(layers).forEach(key=>active.add(key));renderLayers();renderMarkers()};document.querySelector('#zoomIn').onclick=()=>setZoom(zoom+.1);document.querySelector('#zoomOut').onclick=()=>setZoom(zoom-.1);
document.querySelector('#issueList').innerHTML=issues.map(item=>`<div class="issue-row"><span class="priority" style="--p:${item.color}">${item.p}</span><strong>${item.text}</strong><span class="issue-owner">${item.owner}</span><span class="issue-date">${item.date}</span></div>`).join('');renderAll();
