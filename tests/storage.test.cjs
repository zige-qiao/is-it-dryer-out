const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('../src/services/storage.js');
const { UI_PREFERENCES_STORAGE_KEY, PLAN_STORAGE_KEY } = require('../src/config.js');
const { environment, memoryStorage } = require('./helpers/browser.cjs');

test('preferences preserve defaults and restore saved booleans across controller instances',()=>{
  const localStorage=memoryStorage();
  const make=()=>{
    const uiPreferences={showIndoorSummary:false,openIndoorOnLaunch:true};let applied=0;
    const storage=createStorage({uiPreferences,applyUiPreferences(){applied++;}},environment({localStorage}));
    return {storage,uiPreferences,get applied(){return applied;}};
  };
  const first=make();first.storage.loadUiPreferences();
  assert.deepEqual(first.uiPreferences,{showIndoorSummary:false,openIndoorOnLaunch:true});assert.equal(first.applied,1);
  Object.assign(first.uiPreferences,{showIndoorSummary:true,openIndoorOnLaunch:false});first.storage.saveUiPreferences();
  const second=make();second.storage.loadUiPreferences();assert.deepEqual(second.uiPreferences,first.uiPreferences);
  localStorage.setItem(UI_PREFERENCES_STORAGE_KEY,'bad json');const invalid=make();invalid.storage.loadUiPreferences();
  assert.deepEqual(invalid.uiPreferences,{showIndoorSummary:false,openIndoorOnLaunch:true});assert.equal(invalid.applied,1);
});

test('existing plan data migrates opening settings and preserves validated numeric values',()=>{
  const localStorage=memoryStorage(),state={minTemp:18,targetRh:55,roomLength:4,roomWidth:5,roomHeight:2.5,customAirflow:80};
  localStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify({minTemp:20.4,targetRh:60,ventilationSpeed:'fast',roomPreset:'large'}));
  createStorage({state},environment({localStorage})).loadPlanSettings();
  assert.deepEqual(state,{minTemp:20,targetRh:60,roomLength:4,roomWidth:5,roomHeight:2.5,customAirflow:80,openingSetup:'cross',roomPreset:'large'});
});

test('capture and entry visibility preferences persist independently and invalid values retain defaults',()=>{
 const localStorage=memoryStorage(), defaults={useStillPhotos:false,showCameraButton:true,showVoiceButton:false};
 const make=()=>{const uiPreferences={...defaults};return {uiPreferences,storage:createStorage({uiPreferences,applyUiPreferences(){}},environment({localStorage}))};};
 const fresh=make();fresh.storage.loadUiPreferences();assert.deepEqual(fresh.uiPreferences,defaults);
 for(const camera of [true,false])for(const voice of [true,false])for(const photos of [true,false]){
   const first=make();Object.assign(first.uiPreferences,{useStillPhotos:photos,showCameraButton:camera,showVoiceButton:voice});first.storage.saveUiPreferences();
   const second=make();second.storage.loadUiPreferences();assert.deepEqual(second.uiPreferences,first.uiPreferences);
 }
 for(const saved of [{},{useStillPhotos:'true',showCameraButton:0,showVoiceButton:null}]){
   localStorage.setItem(UI_PREFERENCES_STORAGE_KEY,JSON.stringify(saved));const f=make();f.storage.loadUiPreferences();assert.deepEqual(f.uiPreferences,defaults);
 }
 localStorage.setItem(UI_PREFERENCES_STORAGE_KEY,'bad json');const invalid=make();invalid.storage.loadUiPreferences();assert.deepEqual(invalid.uiPreferences,defaults);
});
