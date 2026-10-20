/** Bound to the user's spreadsheet. Passwords are never stored in source code. */
const DATA_SHEET = '校園安全圖釘';
const AUDIT_SHEET = '操作紀錄';
const HEADERS = ['圖釘ID','版本','狀態','圖層','名稱','X百分比','Y百分比','主責單位','管理內容','說明','提出人','聯絡方式','問題理由','改善建議','處理進度','更新時間','刪除時間','完整資料'];
const AUDIT_HEADERS = ['時間','操作','圖釘ID','版本','內容快照'];
function install() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== '1kBAX215x-DrpNr9UYQLfTS2lmf_nVUK2c13gKuN5Jsc') throw new Error('請在指定試算表的擴充功能 → Apps Script 執行。');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  [[DATA_SHEET, HEADERS], [AUDIT_SHEET, AUDIT_HEADERS]].forEach(([name, headers]) => {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    if (!sheet.getLastRow()) {
      sheet.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#0a7f78').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1,headers.length,130);
      sheet.setColumnWidth(headers.length,300);
    } else if (JSON.stringify(sheet.getRange(1,1,1,headers.length).getValues()[0]) !== JSON.stringify(headers)) throw new Error(name+'欄位不符，請先備份確認。');
  });
  if (!props.getProperty('PASSWORD_HASH')) {
    const ui = SpreadsheetApp.getUi();
    const answer = ui.prompt('設定共用儲存與刪除密碼','請輸入原先指定的管理密碼；密碼不會寫入試算表或程式碼。',ui.ButtonSet.OK_CANCEL);
    if (answer.getSelectedButton() !== ui.Button.OK) throw new Error('已取消密碼設定。');
    const password = answer.getResponseText();
    if (password.length < 12) throw new Error('請使用至少12字元的管理密碼。');
    const salt = Utilities.getUuid()+Utilities.getUuid();
    props.setProperties({PASSWORD_SALT:salt,PASSWORD_HASH:passwordHash_(salt,password)});
  }
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('初始化完成。請部署為網頁應用程式：執行身分為我，存取權為任何人。資料仍需管理密碼登入才能讀取。');
}
function passwordHash_(salt,password) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'\n'+password,Utilities.Charset.UTF_8).map(n=>('0'+((n+256)%256).toString(16)).slice(-2)).join(''); }
function checkPassword_(password) {
  const props=PropertiesService.getScriptProperties(),salt=props.getProperty('PASSWORD_SALT'),expected=props.getProperty('PASSWORD_HASH');
  if (!salt || !expected) fail_('NOT_INSTALLED','請先執行 install 初始化。');
  const actual=passwordHash_(salt,String(password||''));
  let diff=actual.length^expected.length;for(let i=0;i<expected.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
  if(diff)fail_('PASSWORD','管理密碼不正確。');
}
function fail_(code,message){const error=new Error(message);error.code=code;throw error;}
function table_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)fail_('NOT_INSTALLED','請先初始化。');return SpreadsheetApp.openById(id);}
function readRows_(ss){const sh=ss.getSheetByName(DATA_SHEET);if(!sh)fail_('NOT_INSTALLED','找不到圖釘工作表。');return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).getValues().map((r,i)=>({row:i+2,point:JSON.parse(r[17])}));}
function revision_(ss){return ss.getSheetByName(AUDIT_SHEET).getLastRow()-1;}
function safeCell_(value){const s=String(value==null?'':value);return /^[=+@\-]/.test(s)?"'"+s:s;}
function writePoint_(ss,row,p){const values=[p.id,p.version,p.deletedAt?'已刪除':p.status,p.layer,p.title,p.x,p.y,p.owner,p.asset,p.note,p.proposer,p.contact,p.reason,p.action,p.followupStatus,p.updatedAt,p.deletedAt||'',JSON.stringify(p)].map(safeCell_);ss.getSheetByName(DATA_SHEET).getRange(row,1,1,HEADERS.length).setValues([values]);}
function audit_(ss,action,p){ss.getSheetByName(AUDIT_SHEET).appendRow([new Date().toISOString(),action,p.id,p.version,JSON.stringify(p)].map(safeCell_));}
function normalize_(raw){
  if(!raw||typeof raw!=='object')fail_('INVALID','缺少圖釘資料。');
  const p={};
  ['id','layer','title','owner','asset','note','proposer','contact','reason','action','followupStatus'].forEach(k=>{p[k]=String(raw[k]||'');if(p[k].length>3000)fail_('INVALID','欄位過長。');});
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)||!['space','management','security','help','route','light','visibility'].includes(p.layer))fail_('INVALID','圖釘ID或圖層不正確。');
  p.x=Number(raw.x);p.y=Number(raw.y);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>100||p.y<0||p.y>100)fail_('INVALID','圖釘座標不正確。');
  p.status=['red','amber','green'].includes(raw.status)?raw.status:'amber';p.custom=true;p.alert=Boolean(raw.alert);return p;
}
function doGet(){return json_({ok:true,service:'ymhs-campus-safety',version:1,message:'請由校園安全網站登入；本入口不提供公開資料。'});}
function doPost(e){
  let lock;
  try{
    const text=e&&e.postData&&e.postData.contents||'';if(text.length>60000)fail_('INVALID','資料過大。');
    const req=JSON.parse(text),cache=CacheService.getScriptCache();
    if(req.action==='login'){
      if(Number(cache.get('login-failures')||0)>=30)fail_('RATE_LIMIT','嘗試過於頻繁，請稍後再試。');
      try{checkPassword_(req.password);}catch(err){if(err.code==='PASSWORD')cache.put('login-failures',String(Number(cache.get('login-failures')||0)+1),300);throw err;}
      const token=Utilities.getUuid()+Utilities.getUuid();cache.put('session:'+token,'1',21600);return json_({ok:true,token});
    }
    if(typeof req.token!=='string'||!cache.get('session:'+req.token))fail_('AUTH','登入已逾時，請重新連接共用試算表。');
    if(!['list','upsert','delete','clear'].includes(req.action))fail_('INVALID','不支援的操作。');
    lock=LockService.getScriptLock();if(!lock.tryLock(15000))fail_('BUSY','其他人正在儲存，請稍後重試。');
    const ss=table_(),rows=readRows_(ss);
    if(req.action==='list')return json_({ok:true,points:rows.map(r=>r.point).filter(p=>!p.deletedAt),revision:revision_(ss)});
    if(req.action==='upsert'){
      const p=normalize_(req.point),found=rows.find(r=>r.point.id===p.id),version=found?found.point.version:0;
      if(found&&found.point.deletedAt)fail_('DELETED','此圖釘已被刪除，不可由舊資料重新建立。');
      if(found&&req.requestId&&found.point.lastRequestId===req.requestId)return json_({ok:true,point:found.point,revision:revision_(ss)});
      if(Number(req.expectedVersion)!==version)fail_('CONFLICT','其他人已修改這枚圖釘，請先備份本機資料，再重新載入共用資料。');
      p.version=version+1;p.updatedAt=new Date().toISOString();p.lastRequestId=String(req.requestId||'').slice(0,100);
      writePoint_(ss,found?found.row:ss.getSheetByName(DATA_SHEET).getLastRow()+1,p);audit_(ss,found?'修改':'新增',p);SpreadsheetApp.flush();
      return json_({ok:true,point:p,revision:revision_(ss)});
    }
    // Deletion can only happen here after a fresh server-side password check.
    checkPassword_(req.password);
    if(req.action==='clear'&&Number(req.expectedRevision)!==revision_(ss))fail_('CONFLICT','共用資料剛有變更，請重新載入後再清除。');
    const targets=req.action==='clear'?rows.filter(r=>!r.point.deletedAt):rows.filter(r=>r.point.id===req.id&&!r.point.deletedAt);
    if(req.action==='delete'&&targets.length&&Number(req.expectedVersion)!==targets[0].point.version)fail_('CONFLICT','圖釘已更新，請重新載入後再刪除。');
    targets.forEach(r=>{const p=r.point;p.version++;p.deletedAt=new Date().toISOString();p.updatedAt=p.deletedAt;writePoint_(ss,r.row,p);audit_(ss,req.action==='clear'?'清除':'刪除',p);});
    SpreadsheetApp.flush();return json_({ok:true,deleted:targets.map(r=>r.point.id),revision:revision_(ss)});
  }catch(error){return json_({ok:false,code:error.code||'SERVER',error:error.code?error.message:'儲存服務發生錯誤，請稍後重試或檢查 Apps Script 執行紀錄。'});}
  finally{if(lock)lock.releaseLock();}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
