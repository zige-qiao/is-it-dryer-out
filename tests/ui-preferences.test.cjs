const {test}=require('node:test'), assert=require('node:assert/strict');
const {createEvents}=require('../src/ui/events.js');
const {element}=require('./helpers/browser.cjs');
test('entry visibility obeys both saved preferences and speech support without affecting active-flow controls',()=>{
 for(const voiceSupported of [true,false])for(const showCameraButton of [true,false])for(const showVoiceButton of [true,false]){
   const names=['showIndoorSummary','openIndoorOnLaunch','autoFlash','useStillPhotos','showCameraButton','showVoiceButton','cameraInputButton','voiceInputButton','cameraRetakeButton','voiceListenButton'];
   const elements=Object.fromEntries(names.map(name=>[name,element()])),summary=element();
   const preferences={showIndoorSummary:false,openIndoorOnLaunch:true,autoFlash:true,useStillPhotos:false,showCameraButton,showVoiceButton};
   const document={documentElement:{dataset:{}},querySelector:()=>summary};
   createEvents({elements,uiPreferences:preferences,voiceSupported},{document}).applyUiPreferences();
   assert.equal(elements.cameraInputButton.hidden,!showCameraButton);
   assert.equal(elements.voiceInputButton.hidden,!voiceSupported||!showVoiceButton);assert.equal(summary.hidden,elements.voiceInputButton.hidden);
   assert.equal(elements.cameraRetakeButton.hidden,false);assert.equal(elements.voiceListenButton.hidden,false);
 }
});
