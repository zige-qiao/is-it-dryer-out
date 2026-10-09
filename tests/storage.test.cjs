const {pageLayoutDefaults}=require('../src/ui/page-layout.js');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('../src/services/storage.js');
const { UI_PREFERENCES_STORAGE_KEY, PLAN_STORAGE_KEY } = require('../src/config.js');
const { environment, memoryStorage } = require('./helpers/browser.cjs');

test('preferences preserve defaults and restore saved booleans across controller instances',()=>{
  const localStorage=memoryStorage();
  const make=()=>{
    const uiPreferences={...pageLayoutDefaults(),openIndoorOnLaunch:true};let applied=0;
    const storage=createStorage({uiPreferences,applyUiPreferences(){applied++;}},environment({localStorage}));
    return {storage,uiPreferences,get applied(){return applied;}};
  };
  const first=make();first.storage.loadUiPreferences();
  assert.deepEqual(first.uiPreferences,{...pageLayoutDefaults(),openIndoorOnLaunch:true});assert.equal(first.applied,1);
  Object.assign(first.uiPreferences,{showIndoorSummary:true,openIndoorOnLaunch:false});first.storage.saveUiPreferences();
  const second=make();second.storage.loadUiPreferences();assert.deepEqual(second.uiPreferences,first.uiPreferences);
  localStorage.setItem(UI_PREFERENCES_STORAGE_KEY,'bad json');const invalid=make();invalid.storage.loadUiPreferences();
  assert.deepEqual(invalid.uiPreferences,{...pageLayoutDefaults(),openIndoorOnLaunch:true});assert.equal(invalid.applied,1);
});

test('existing plan data migrates opening settings and preserves validated numeric values',()=>{
  const localStorage=memoryStorage(),state={minTemp:18,targetRh:55,roomLength:4,roomWidth:5,roomHeight:2.5,customAirflow:80};
  localStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify({minTemp:20.4,targetRh:60,ventilationSpeed:'fast',roomPreset:'large'}));
  createStorage({state},environment({localStorage})).loadPlanSettings();
  assert.deepEqual(state,{minTemp:20,targetRh:60,roomLength:4,roomWidth:5,roomHeight:2.5,customAirflow:80,openingSetup:'cross',roomPreset:'large'});
});

test('plan range endpoints survive saving and loading; outside values retain defaults',()=>{
  const localStorage=memoryStorage();
  for(const minTemp of [8,28]) for(const targetRh of [35,65]) {
    createStorage({state:{minTemp,targetRh}},environment({localStorage})).savePlanSettings();
    const restored={minTemp:18,targetRh:55};
    createStorage({state:restored},environment({localStorage})).loadPlanSettings();
    assert.equal(restored.minTemp,minTemp); assert.equal(restored.targetRh,targetRh);
  }
  for(const saved of [{minTemp:7,targetRh:34},{minTemp:29,targetRh:66}]) {
    localStorage.setItem(PLAN_STORAGE_KEY,JSON.stringify(saved));
    const restored={minTemp:18,targetRh:55};
    createStorage({state:restored},environment({localStorage})).loadPlanSettings();
    assert.equal(restored.minTemp,18); assert.equal(restored.targetRh,55);
  }
});

test('blocked or full storage keeps defaults and never interrupts saving',()=>{
  const blocked=Object.create(globalThis,{localStorage:{get(){throw new Error('SecurityError');}}});
  const full=environment({localStorage:{getItem:()=>null,setItem(){throw new Error('QuotaExceededError');},removeItem(){}}});
  for(const env of [blocked,full]){
    const state={indoorTemp:24,indoorRh:58,targetRh:55,minTemp:18,location:{name:'Sale',latitude:53.4,longitude:-2.3}};
    const uiPreferences={showIndoorSummary:false};
    const storage=createStorage({state,uiPreferences,applyUiPreferences(){}},env);
    assert.doesNotThrow(()=>{
      storage.loadIndoorReadings();storage.loadPlanSettings();storage.loadUiPreferences();
      storage.saveIndoorReadings();storage.savePlanSettings();storage.saveUiPreferences();storage.saveLocation();
    });
    assert.equal(storage.loadLocation(),false);assert.deepEqual(storage.loadLocationHistory(false),[]);
    assert.equal(state.indoorTemp,24);assert.ok(state.indoorLastSet>0);
  }
});

test('capture and entry visibility preferences persist independently and invalid values retain defaults',()=>{
 const localStorage=memoryStorage(), defaults={...pageLayoutDefaults(),useStillPhotos:false,showCameraButton:true,showVoiceButton:false};
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


test('Chart key defaults to collapsed and restores only valid saved booleans',()=>{
 for(const saved of [undefined,true,false,'true',1,null]){
  const localStorage=memoryStorage(),uiPreferences={showChartKey:false};
  localStorage.setItem(UI_PREFERENCES_STORAGE_KEY,JSON.stringify({showChartKey:saved}));
  createStorage({uiPreferences,applyUiPreferences(){}},environment({localStorage})).loadUiPreferences();
  assert.equal(uiPreferences.showChartKey,saved===true);
 }
});
