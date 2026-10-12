const {test}=require('node:test'), assert=require('node:assert/strict');
const {createEvents}=require('../src/ui/events.js');
const {element}=require('./helpers/browser.cjs');
test('entry visibility obeys both saved preferences and speech support without affecting active-flow controls',()=>{
 for(const voiceSupported of [true,false])for(const showCameraButton of [true,false])for(const showVoiceButton of [true,false]){
   const names=['showIndoorSummary','openIndoorOnLaunch','autoFlash','useStillPhotos','showCameraButton','settingsCameraOptions','showVoiceButton','cameraInputButton','voiceInputButton','cameraRetakeButton','voiceListenButton'];
   const elements=Object.fromEntries(names.map(name=>[name,element()])),summary=element();
   const preferences={showIndoorSummary:false,openIndoorOnLaunch:true,autoFlash:true,useStillPhotos:false,showCameraButton,showVoiceButton};
   elements.settingsCameraOptions.contains=()=>false;
   const summaryCamera=element(); const document={documentElement:{dataset:{}},querySelector:selector=>selector==='#indoorSummaryCamera'?summaryCamera:summary};
   createEvents({elements,uiPreferences:preferences,voiceSupported},{document}).applyUiPreferences();
   assert.equal(elements.cameraInputButton.hidden,!showCameraButton); assert.equal(summaryCamera.hidden,!showCameraButton);
   assert.equal(elements.settingsCameraOptions.hidden,!showCameraButton);
   assert.equal(elements.voiceInputButton.hidden,!voiceSupported||!showVoiceButton);assert.equal(summary.hidden,elements.voiceInputButton.hidden);
   assert.equal(elements.cameraRetakeButton.hidden,false);assert.equal(elements.voiceListenButton.hidden,false);
 }
});

test('camera options retain saved values across visibility changes and return hidden focus to the parent switch',()=>{
 for(const autoFlash of [true,false])for(const useStillPhotos of [true,false]){
  const names=['showIndoorSummary','openIndoorOnLaunch','autoFlash','useStillPhotos','showCameraButton','settingsCameraOptions'];
  const elements=Object.fromEntries(names.map(name=>[name,element()]));
  const document={activeElement:elements.autoFlash,querySelector:()=>null};
  elements.settingsCameraOptions.contains=target=>target===elements.autoFlash||target===elements.useStillPhotos;
  elements.showCameraButton.focus=()=>{document.activeElement=elements.showCameraButton;};
  const preferences={showCameraButton:true,autoFlash,useStillPhotos};
  const events=createEvents({elements,uiPreferences:preferences},{document});
  events.applyUiPreferences();assert.equal(elements.settingsCameraOptions.hidden,false);
  preferences.showCameraButton=false;events.applyUiPreferences();
  assert.equal(elements.settingsCameraOptions.hidden,true);assert.equal(document.activeElement,elements.showCameraButton);
  preferences.showCameraButton=true;events.applyUiPreferences();
  assert.equal(elements.settingsCameraOptions.hidden,false);
  assert.equal(elements.autoFlash.checked,autoFlash);assert.equal(elements.useStillPhotos.checked,useStillPhotos);
  assert.equal(preferences.autoFlash,autoFlash);assert.equal(preferences.useStillPhotos,useStillPhotos);
  document.activeElement=elements.openIndoorOnLaunch;preferences.showCameraButton=false;events.applyUiPreferences();
  assert.equal(document.activeElement,elements.openIndoorOnLaunch);
 }
});
