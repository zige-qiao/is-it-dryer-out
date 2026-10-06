const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCropEditor,changeCrop}=require('../src/camera/crop-editor.js');
const {element}=require('./helpers/browser.cjs');
function fixture(){
  const surface=element(),boxes={temperature:element(),humidity:element(),pending:element()},choices={temperature:element(),humidity:element()},changes=[],commits=[];
  let captured=null;
  Object.assign(surface,{getBoundingClientRect:()=>({left:10,top:20,width:400,height:300}),setPointerCapture:id=>captured=id,hasPointerCapture:id=>captured===id,releasePointerCapture:()=>captured=null});
  const editor=createCropEditor({surface,boxes,choices,onChange:(field,crop)=>changes.push({field,crop}),onCommit:field=>commits.push(field)});
  editor.initialize();editor.update({temperature:{x:.1,y:.2,width:.35,height:.2},humidity:null});
  const event=(x,y,field,handle)=>({clientX:x+10,clientY:y+20,pointerId:1,button:0,isPrimary:true,preventDefault(){},target:{closest:selector=>selector==='[data-camera-field]'&&field?{dataset:{cameraField:field}}:selector==='[data-crop-handle]'&&handle?{dataset:{cropHandle:handle}}:null}});
  return {surface,boxes,choices,editor,changes,commits,event};
}
test('direct box dragging stays within the image and reads only after release',()=>{
  const f=fixture();f.surface.emit('pointerdown',f.event(100,90,'temperature'));f.surface.emit('pointermove',f.event(500,500));
  assert.deepEqual(f.changes.at(-1),{field:'temperature',crop:{x:.65,y:.8,width:.35,height:.2}});assert.deepEqual(f.commits,[]);
  f.surface.emit('pointerup',f.event(500,500));assert.deepEqual(f.commits,['temperature']);
});
test('a corner drag resizes the box while retaining the opposite corner',()=>{
  const f=fixture();f.surface.emit('pointerdown',f.event(180,120,'temperature','se'));f.surface.emit('pointermove',f.event(220,180));
  const crop=f.changes.at(-1).crop;assert.equal(crop.x,.1);assert.equal(crop.y,.2);assert.ok(Math.abs(crop.width-.45)<1e-9);assert.ok(Math.abs(crop.height-.4)<1e-9);
  assert.ok(changeCrop(crop,-2,-2,'se').width>=.02);
});
test('drawing empty image space creates an unassigned box without selecting a field',()=>{
 const f=fixture();f.surface.emit('pointerdown',f.event(260,80));f.surface.emit('pointermove',f.event(350,180));f.surface.emit('pointerup',f.event(350,180));
 assert.equal(f.changes.at(-1).field,'pending');assert.equal(f.boxes.pending.hidden,false);assert.deepEqual(f.commits,['pending']);
});
test('cancelled gestures restore the region and reset cannot resurrect an old selection',()=>{
  const f=fixture();f.surface.emit('pointerdown',f.event(100,90,'temperature'));f.surface.emit('pointermove',f.event(150,100));f.surface.emit('pointercancel',f.event(150,100));
  assert.deepEqual(f.changes.at(-1).crop,{x:.1,y:.2,width:.35,height:.2});assert.equal(f.commits.length,0);
  f.editor.reset();assert.equal(f.boxes.temperature.hidden,true);assert.equal(f.boxes.humidity.hidden,true);
});
test('keyboard editing moves a box and resizes its chosen corner',()=>{
  const f=fixture();f.boxes.temperature.emit('keydown',{key:'ArrowRight',preventDefault(){}});assert.ok(Math.abs(f.changes.at(-1).crop.x-.11)<1e-9);
  f.boxes.temperature.emit('keydown',{key:'ArrowDown',target:{dataset:{cropHandle:'se'}},preventDefault(){}});assert.ok(Math.abs(f.changes.at(-1).crop.height-.21)<1e-9);
  assert.equal(f.commits.length,2);
});
