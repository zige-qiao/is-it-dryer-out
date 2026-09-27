const {test}=require('node:test');
const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function fixture(){
 const style=()=>{const values=new Map();return {getPropertyValue:n=>values.get(n)?.[0]||'',getPropertyPriority:n=>values.get(n)?.[1]||'',setProperty:(n,v,p='')=>values.set(n,[v,p]),removeProperty:n=>values.delete(n)}};
 const body={style:style(),scrollHeight:1800},root={style:style(),clientWidth:1265,scrollHeight:1800},page={style:style(),getBoundingClientRect:()=>({top:-237,left:384.5,width:496})};let openCount=0;const scrolls=[];
 const viewportEvents={},windowEvents={};
 const viewport={height:700,offsetTop:40,addEventListener:(n,fn)=>viewportEvents[n]=fn,removeEventListener:n=>delete viewportEvents[n]};
 const window={scrollX:0,scrollY:237,innerHeight:800,visualViewport:viewport,addEventListener:(n,fn)=>windowEvents[n]=fn,removeEventListener:n=>delete windowEvents[n],requestAnimationFrame:()=>1,cancelAnimationFrame(){},scrollTo:p=>scrolls.push(p)};
 const document={body,documentElement:root,querySelector:selector=>selector==='.app-shell'?page:openCount?{}:null};
 const context=vm.createContext({document,window});vm.runInContext(source.slice(source.indexOf('function createDialogScrollLock()')),context);
 const makeDialog=()=>({open:false,showModal(){this.open=true;openCount++},close(){this.open=false;openCount--}});
 return {lock:context.createDialogScrollLock(),body,root,page,scrolls,makeDialog,viewport,viewportEvents,windowEvents};
}
test('modal freezes visual position and restores exact scroll and prior styles',()=>{
 const f=fixture();f.root.style.setProperty('scroll-behavior','smooth');f.page.style.setProperty('width','90%','important');
 const dialog=f.makeDialog();f.lock.open(dialog);
 assert.equal(f.page.style.getPropertyValue('position'),'fixed');assert.equal(f.page.style.getPropertyValue('top'),'-237px');assert.equal(f.page.style.getPropertyValue('width'),'496px');assert.equal(f.root.style.getPropertyValue('overflow'),'hidden');assert.equal(f.body.style.getPropertyValue('position'),'');assert.equal(f.body.style.getPropertyValue('min-height'),'1800px');
 dialog.close();f.lock.release();assert.equal(f.page.style.getPropertyValue('position'),'');assert.equal(f.page.style.getPropertyValue('width'),'90%');assert.equal(f.page.style.getPropertyPriority('width'),'important');assert.equal(f.root.style.getPropertyValue('scroll-behavior'),'smooth');assert.equal(f.scrolls[0].top,237);
 f.lock.release();assert.equal(f.scrolls.length,1);
});
test('another open modal retains the original lock until the final close',()=>{
 const f=fixture(),a=f.makeDialog(),b=f.makeDialog();f.lock.open(a);f.lock.open(a);f.lock.open(b);a.close();f.lock.release();assert.equal(f.scrolls.length,0);b.close();f.lock.release();assert.equal(f.scrolls.length,1);assert.equal(f.scrolls[0].top,237);
});
test('failed modal opening releases the lock',()=>{
 const f=fixture();assert.throws(()=>f.lock.open({showModal(){throw Error('failed')}}));assert.equal(f.page.style.getPropertyValue('position'),'');assert.equal(f.root.style.getPropertyValue('overflow'),'');assert.equal(f.scrolls[0].top,237);
});

test('sheet follows visible viewport height and offset and removes listeners on close',()=>{
 const f=fixture(),dialog=f.makeDialog();f.lock.open(dialog);
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-height'),'700px');
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-bottom'),'740px');
 f.viewport.height=450;f.viewport.offsetTop=20;f.viewportEvents.resize();
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-height'),'450px');
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-bottom'),'470px');
 f.viewport.height=750;f.viewport.offsetTop=0;f.viewportEvents.scroll();
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-bottom'),'750px');
 dialog.close();f.lock.release();
 assert.equal(f.root.style.getPropertyValue('--sheet-visible-bottom'),'');
 assert.equal(Object.keys(f.viewportEvents).length,0);assert.equal(Object.keys(f.windowEvents).length,0);
});
