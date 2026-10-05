const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'admin.js'),'utf8');
const html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
class Element {
  constructor(){this.value='';this.textContent='';this.innerHTML='';this.dataset={};this.listeners={};this.attrs={};this.files=[];this.classes=new Set();this.classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),contains:v=>this.classes.has(v),toggle:(v,b)=>{const result=b??!this.classes.has(v);result?this.classes.add(v):this.classes.delete(v);return result}};}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  fire(k){return Promise.all((this.listeners[k]||[]).map(fn=>fn({preventDefault(){},target:this})))}
  setAttribute(k,v){this.attrs[k]=v}querySelectorAll(){return []}querySelector(){return new Element()}focus(){}showModal(){this.open=true}close(){this.open=false}
}
function harness({fail=[],reject=[],inventory=[],settings={company_name:'Demo'},user=false,admin=true,hold=false}={}){
  const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  ids.adminStockStatus.value=ids.adminChassisFilter.value=ids.leadAction.value='all';
  const nav=[...html.matchAll(/class="admin-nav[^"]*" data-page="([^"]+)">([^<]+)/g)].map(m=>Object.assign(new Element(),{dataset:{page:m[1]},textContent:m[2]}));
  const panels=nav.map(n=>Object.assign(new Element(),{dataset:{pagePanel:n.dataset.page}}));
  const save=new Element(),login=new Element(),events={},calls={},writes=[],pending=[];
  let authCalls=0;
  const fixtures={inventory,site_settings:settings,salesmen:[],site_events:[],deliveries:[],lead_events:[],admin_users:admin?{user_id:'demo'}:null};
  const client={from(table){let write=false;const q={select(){return q},order(){return q},eq(){return q},limit(){return q},maybeSingle(){return q},in(){return q},update(p){write=true;writes.push([table,p]);return q},upsert(p){write=true;writes.push([table,p]);return q},then(resolve,rejectFn){calls[table]=(calls[table]||0)+1;return new Promise((done,no)=>{const finish=()=>reject.includes(table)?no(new Error('offline')):done({data:fixtures[table],error:fail.includes(table)?{message:'unavailable'}:null});if(hold&&!write)pending.push(finish);else finish()}).then(resolve,rejectFn)}};return q},auth:{getUser:async()=>({data:{user:user?{id:'demo'}:null}}),signInWithPassword:async()=>{authCalls++;await flush();user=true;return {error:null}},signOut:async()=>{user=false}}};
  const document={body:new Element(),getElementById:id=>ids[id]||null,querySelectorAll:s=>s==='.admin-nav'?nav:s==='.admin-page'?panels:[],querySelector:s=>s==='#settingsForm [type=submit]'?save:s==='#loginForm [type=submit]'?login:null,addEventListener(k,fn){events[k]=fn}};
  const location={hash:'',reload(){}};
  const context=vm.createContext({window:{IASBData:{client},addEventListener(k,fn){events[k]=fn},scrollTo(){}},document,location,history:{pushState(a,b,hash){location.hash=hash}},console,setTimeout:()=>0,clearTimeout,URL,Date});
  vm.runInContext(source,context);
  return {ids,save,login,nav,panels,events,calls,writes,pending,fixtures,location,run:s=>vm.runInContext(s,context),get authCalls(){return authCalls}};
}
test('admin HTML has unique IDs and every direct JS element reference exists',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  for(const [,id] of source.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),id);
});
test('refresh requests coalesce and controls recover after one batch',async()=>{
  const h=harness({hold:true});await flush();const one=h.run('loadAll()'),two=h.run('loadAll()');assert.equal(one,two);assert.equal(h.save.disabled,true);await flush();h.pending.splice(0).forEach(fn=>fn());await one;assert.equal(h.calls.inventory,1);assert.equal(h.ids.refreshAdminButton.disabled,false);assert.equal(h.save.disabled,false);
});
test('failed settings read disables save and prevents direct submit writes',async()=>{
  const h=harness({fail:['site_settings']});await h.run('loadAll()');assert.equal(h.save.disabled,true);await h.ids.settingsForm.fire('submit');h.ids.pricelistDate.value='5.10.26';await h.ids.importPricelistButton.fire('click');assert.equal(h.writes.length,0);assert.match(h.ids.settingsReadStatus.textContent,/dikunci/);
});
test('rejected query produces unavailable state rather than zero and can recover',async()=>{
  const fail=['inventory'];const h=harness({reject:fail});await h.run('loadAll()');assert.equal(h.ids.statUnits.textContent,'—');assert.match(h.ids.inventoryTable.innerHTML,/tidak dapat/);fail.pop();await h.run('loadAll()');assert.equal(h.ids.statUnits.textContent,0);assert.match(h.ids.inventoryTable.innerHTML,/Belum ada stok/);
});
test('empty successful read is distinguished from unavailable data',async()=>{
  const h=harness();await h.run('loadAll()');assert.equal(h.ids.statUnits.textContent,0);assert.match(h.ids.dataStatus.textContent,/Data dimuatkan/);assert.equal(h.save.disabled,false);
});
test('filters combine search, status and chassis and survive refresh',async()=>{
  const inventory=[{id:1,brand:'Toyota',model:'Alphard',status:'BOOKED',is_active:true,chassis_no:'DEMO-001'},{id:2,brand:'Toyota',model:'Noah',status:'AVAILABLE',is_active:false}];const h=harness({inventory});await h.run('loadAll()');h.ids.adminStockSearch.value='alph';h.ids.adminStockStatus.value='BOOKED';h.ids.adminChassisFilter.value='complete';h.run('renderInventory()');assert.match(h.ids.inventoryResultCount.textContent,/1 daripada 2/);await h.run('loadAll()');assert.match(h.ids.inventoryResultCount.textContent,/1 daripada 2/);h.ids.adminStockSearch.value='';h.ids.adminStockStatus.value='HIDDEN';h.ids.adminChassisFilter.value='all';h.run('renderInventory()');assert.match(h.ids.inventoryTable.innerHTML,/Noah/);assert.doesNotMatch(h.ids.inventoryTable.innerHTML,/Alphard/);
});
test('enhanced inventory renderer keeps nine aligned cells and escapes model content',async()=>{
  const h=harness({inventory:[{id:1,brand:'Toyota',model:'<script>bad</script>',chassis_no:'DEMO-001',is_active:true}]});await h.run('loadAll()');assert.equal((h.ids.inventoryTable.innerHTML.match(/<td\b/g)||[]).length,9);assert.match(h.ids.inventoryTable.innerHTML,/&lt;script&gt;/);assert.match(h.ids.inventoryTable.innerHTML,/data-photos-car/);
});
test('unknown navigation recovers to overview; history navigation restores section',()=>{
  const h=harness();h.run('openAdminPage("unknown")');assert.equal(h.location.hash,'#dashboard');h.run('openAdminPage("inventory")');assert.equal(h.ids.pageTitle.textContent,'Stock inventory');h.location.hash='#events';h.events.popstate();assert.equal(h.ids.pageTitle.textContent,'Events');assert.equal(h.nav.find(x=>x.dataset.page==='events').attrs['aria-current'],'page');
});
test('repeated login submits share one authentication attempt',async()=>{
  const h=harness();await flush();await Promise.all([h.ids.loginForm.fire('submit'),h.ids.loginForm.fire('submit')]);assert.equal(h.authCalls,1);assert.equal(h.login.disabled,false);assert.equal(h.calls.admin_users,1);
});
test('non-admin cannot enter app or load managed data',async()=>{
  const h=harness({admin:false});await flush();await h.ids.loginForm.fire('submit');assert.match(h.ids.loginMessage.textContent,/bukan admin/);assert.equal(h.calls.inventory,undefined);
});
test('click search and action filter operate on the loaded sample',async()=>{
  const h=harness();h.fixtures.lead_events=[{page:'home',action:'whatsapp',label:'Alphard'},{page:'inventory',action:'detail',label:'Alphard'}];await h.run('loadAll()');h.ids.leadSearch.value='alphard';h.ids.leadAction.value='whatsapp';h.run('renderLeads()');assert.match(h.ids.leadResultCount.textContent,/1 daripada 2/);assert.match(h.ids.leadResultCount.textContent,/maksimum 200/);
});
test('preview server does not serve config, production SDK or allow network connections',()=>{
  const server=fs.readFileSync(path.join(root,'scripts/admin-preview.mjs'),'utf8');assert.match(server,/connect-src 'none'/);assert.match(server,/127\.0\.0\.1/);assert.doesNotMatch(fs.readFileSync(path.join(root,'build.mjs'),'utf8'),/admin-demo|admin-preview/);
});
