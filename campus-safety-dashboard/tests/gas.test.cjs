const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function backend(){
 const tables=new Map(),props=new Map(),cache=new Map();let userEmail='btosichen@gmail.com';
 class Sheet{constructor(name){this.rows=[];this.name=name;}getLastRow(){return this.rows.length;}getRange(r,c,n=1,m=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[r-1+i]?.[c-1+j]??'')),setValues:values=>{values.forEach((v,i)=>{this.rows[r-1+i]??=[];v.forEach((x,j)=>this.rows[r-1+i][c-1+j]=x);});return this.getRange(r,c,n,m);},setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;}};}appendRow(row){this.rows.push(row);}setFrozenRows(){}setColumnWidths(){}setColumnWidth(){}}
 const ss={getId:()=> '1kBAX215x-DrpNr9UYQLfTS2lmf_nVUK2c13gKuN5Jsc',getSheetByName:n=>tables.get(n),insertSheet:n=>{const s=new Sheet(n);tables.set(n,s);return s;}};
 const ui={ButtonSet:{OK_CANCEL:1},Button:{OK:1},prompt:()=>({getSelectedButton:()=>1,getResponseText:()=> 'test-password-for-suite'}),alert(){}};
 const ctx={console,Session:{getActiveUser:()=>({getEmail:()=>userEmail})},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,getUi:()=>ui,flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),setProperties:o=>Object.entries(o).forEach(([k,v])=>props.set(k,v))})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ContentService:{MimeType:{JSON:1},createTextOutput:text=>({setMimeType:()=>text})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../gas/Code.gs','utf8'),ctx);ctx.install();const post=data=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(data)}}));return {post,tables,props,setUser:email=>{userEmail=email;},configure:ctx.saveAdminPassword};
}
const point={id:'custom-test',layer:'space',title:'測試',x:20,y:30,status:'amber',reason:'問題'};
const password='test-password-for-suite';
test('saving is public while every read needs the password',()=>{const b=backend();assert.equal(b.post({action:'list'}).code,'PASSWORD');assert.equal(b.post({action:'list',password:'wrong'}).code,'PASSWORD');assert.equal(b.post({action:'upsert',point,expectedVersion:0,requestId:'new'}).ok,true);assert.equal(b.post({action:'list',password}).points.length,1);assert.equal(b.post({action:'list'}).code,'PASSWORD');assert.ok(!JSON.stringify([...b.props]).includes(password));});
test('receipts do not leak records; stale writes and unauthorized deletes are rejected',()=>{const b=backend(),call=(action,data={})=>b.post({action,...data});
 let r=call('upsert',{point,expectedVersion:0,requestId:'one'});assert.equal(r.receipt.version,1);assert.equal(r.point,undefined);assert.equal(r.receipt.reason,undefined);
 r=call('upsert',{point,expectedVersion:0,requestId:'one'});assert.equal(r.receipt.version,1);assert.equal(b.tables.get('操作紀錄').rows.length,2);
 assert.equal(call('upsert',{point,expectedVersion:0,requestId:'two'}).code,'CONFLICT');
 call('upsert',{point:{...point,id:'second'},expectedVersion:0,requestId:'second'});assert.equal(call('list',{password}).points.length,2);
 assert.equal(call('delete',{id:point.id,expectedVersion:1,password:'wrong'}).code,'PASSWORD');assert.equal(call('list',{password}).points.length,2);
 assert.equal(call('delete',{id:point.id,expectedVersion:1,password}).ok,true);assert.equal(call('list',{password}).points.length,1);
 assert.equal(call('upsert',{point,expectedVersion:0,requestId:'one'}).code,'DELETED');
 const rev=call('list',{password}).revision;assert.equal(call('clear',{password,expectedRevision:rev-1}).code,'CONFLICT');
 assert.equal(call('clear',{password,expectedRevision:rev}).ok,true);assert.equal(call('list',{password}).points.length,0);assert.equal(b.tables.get('校園安全圖釘').rows.length,3);
});
test('rejects invalid coordinates and prevents sheet formulas',()=>{const b=backend();assert.equal(b.post({action:'upsert',point:{...point,x:101},expectedVersion:0}).code,'INVALID');b.post({action:'upsert',point:{...point,title:'=IMPORTXML("https://example.com")'},expectedVersion:0});assert.match(b.tables.get('校園安全圖釘').rows[1][4],/^'=/);});
test('only the spreadsheet manager can configure a password; stores only a salted hash',()=>{
 const b=backend(),previous=b.props.get('PASSWORD_HASH');b.setUser('someone@example.com');assert.throws(()=>b.configure('replacement-test-password'));assert.equal(b.props.get('PASSWORD_HASH'),previous);
 b.setUser('btosichen@gmail.com');assert.throws(()=>b.configure('short'));b.configure('replacement-test-password');assert.notEqual(b.props.get('PASSWORD_HASH'),previous);assert.ok(!JSON.stringify([...b.props]).includes('replacement-test-password'));assert.equal(b.post({action:'list',password:'replacement-test-password'}).ok,true);assert.equal(b.post({action:'list',password}).code,'PASSWORD');
});
module.exports={backend};
