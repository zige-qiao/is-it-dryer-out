const {test}=require('node:test');
const assert=require('node:assert/strict');
const { environment } = require('./helpers/browser.cjs');
const { createDialogs } = require('../src/ui/dialogs.js');
function fixture(){
 const style=()=>{const values=new Map();return {getPropertyValue:n=>values.get(n)?.[0]||'',getPropertyPriority:n=>values.get(n)?.[1]||'',setProperty:(n,v,p='')=>values.set(n,[v,p]),removeProperty:n=>values.delete(n)}};
 const body={style:style(),scrollHeight:1800},root={style:style(),clientWidth:1265,scrollHeight:1800},page={style:style(),getBoundingClientRect:()=>({top:-237,left:384.5,width:496})};let openCount=0;const scrolls=[];
 const viewportEvents={},windowEvents={};
 const viewport={height:700,offsetTop:40,addEventListener:(n,fn)=>viewportEvents[n]=fn,removeEventListener:n=>delete viewportEvents[n]};
 const window={scrollX:0,scrollY:237,innerHeight:800,visualViewport:viewport,addEventListener:(n,fn)=>windowEvents[n]=fn,removeEventListener:n=>delete windowEvents[n],requestAnimationFrame:()=>1,cancelAnimationFrame(){},scrollTo:p=>scrolls.push(p)};
 const document={body,documentElement:root,querySelector:selector=>selector==='.app-shell'?page:openCount?{}:null};
 const context=createDialogs({}, environment({document,window}));
 const makeDialog=()=>({open:false,showModal(){this.open=true;openCount++},close(){this.open=false;openCount--}});
 return {lock:context.createDialogScrollLock(),body,root,page,scrolls,makeDialog,viewport,viewportEvents,windowEvents,document};
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

test('shared header measurement follows wrapping and bounds help below its actual viewport position',()=>{
 const values=new Map(),observed=[];let resized;
 const headerBounds={height:96,bottom:300};
 const surface={classList:{add(){}},addEventListener(){},querySelector:()=>null};
 const header={getBoundingClientRect:()=>headerBounds};
 const dialog={querySelector:selector=>selector==='.sheet-header'?header:selector==='.sheet-handle'||selector==='.sheet-footer'?null:surface,style:{setProperty:(name,value)=>values.set(name,value)},addEventListener(){}};
 const viewport={height:700,offsetTop:40};
 const ResizeObserver=class{constructor(callback){resized=callback}observe(target){observed.push(target)}};
 const context=createDialogs({},environment({window:{visualViewport:viewport,innerHeight:800},ResizeObserver}));
 context.enableSheetDrag(dialog);
 assert.deepEqual(observed,[header,dialog]);assert.equal(values.get('--sheet-header-height'),'96px');assert.equal(values.get('--sheet-help-height'),'424px');
 headerBounds.height=150;headerBounds.bottom=480;resized();assert.equal(values.get('--sheet-header-height'),'150px');assert.equal(values.get('--sheet-help-height'),'244px');
 viewport.height=350;viewport.offsetTop=20;resized();assert.equal(values.get('--sheet-help-height'),'44px');
 headerBounds.height=0;resized();assert.equal(values.get('--sheet-header-height'),'150px');
});


test('keyboard padding follows editable viewport reduction, recovery and zoom without guessed heights',()=>{
 const f=fixture(),dialog=f.makeDialog();f.root.style.setProperty('--sheet-keyboard-safe-area','9px');f.lock.open(dialog);
 f.viewport.height=450;f.viewportEvents.resize();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'');
 f.document.activeElement={matches:()=>true};f.viewportEvents.resize();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'0px');
 f.document.activeElement=null;f.viewportEvents.scroll();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'0px');
 f.viewport.height=700;f.viewportEvents.resize();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'');
 f.document.activeElement={matches:()=>true};f.viewport.height=350;f.viewport.scale=2;f.viewportEvents.resize();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'');
 f.viewport.scale=1;f.viewportEvents.resize();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'0px');
 dialog.close();f.lock.release();assert.equal(f.root.style.getPropertyValue('--sheet-keyboard-safe-area'),'9px');
});

test('help height clears the visible footer and reclaims its space when modes hide it',()=>{
 const values=new Map();let resized;const footerBounds={height:80,top:420};
 const header={getBoundingClientRect:()=>({height:100,bottom:200})},footer={getBoundingClientRect:()=>footerBounds};
 const surface={classList:{add(){}},addEventListener(){},querySelector:()=>null};
 const dialog={getBoundingClientRect:()=>({bottom:600}),querySelector:s=>s==='.sheet-header'?header:s==='.sheet-footer'?footer:s==='.sheet-handle'?null:surface,style:{setProperty:(k,v)=>values.set(k,v)},addEventListener(){}};
 const ResizeObserver=class{constructor(fn){resized=fn}observe(){}};
 createDialogs({},environment({window:{visualViewport:{height:700,offsetTop:0},innerHeight:700},ResizeObserver})).enableSheetDrag(dialog);
 assert.equal(values.get('--sheet-help-height'),'204px');footerBounds.height=0;resized();assert.equal(values.get('--sheet-help-height'),'384px');
});
