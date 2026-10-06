const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCameraHelp}=require('../src/camera/help.js');
const {element}=require('./helpers/browser.cjs');
function fixture(){const button=element(),content=element(),dialog=element(),document={activeElement:null};
 const help=createCameraHelp({button,content,dialog},document);help.initialize();return {button,content,dialog,document,help};}
test('reading help supports hover, focus and explicit touch toggling',()=>{
 const f=fixture();assert.equal(f.content.hidden,true);f.button.emit('pointerenter');assert.equal(f.content.hidden,false);
 f.button.emit('pointerleave');assert.equal(f.content.hidden,true);f.button.emit('focus');assert.equal(f.content.hidden,false);
 f.button.emit('click');f.button.emit('blur');assert.equal(f.content.hidden,false);f.button.emit('click');assert.equal(f.content.hidden,true);
 assert.equal(f.button.getAttribute('aria-expanded'),'false');
});
test('Escape closes help before the sheet; outside pointer interactions are not consumed',()=>{
 const f=fixture();f.button.emit('click');let prevented=0,stopped=0;
 f.dialog.emit('keydown',{key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});
 assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(f.content.hidden,true);
 f.dialog.emit('keydown',{key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});assert.equal(prevented,1);
 f.button.emit('click');f.dialog.emit('pointerdown',{target:element(),preventDefault(){throw Error('Outside interaction consumed');}});assert.equal(f.content.hidden,true);
 f.button.emit('click');f.help.close();assert.equal(f.content.hidden,true);f.button.emit('click');f.dialog.emit('close');assert.equal(f.content.hidden,true);
});
