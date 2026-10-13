const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { voiceFixture, flush } = require('./helpers/voice.cjs');
const index = readFileSync(require.resolve('../index.html'), 'utf8');

test('iOS holds the microphone before starting speech recognition', async () => {
  const f=voiceFixture({deferred:true}); f.controller.startVoiceInput();
  assert.deepEqual(f.order,['media request']);
  f.resolveMedia(); await flush();
  assert.deepEqual(f.order,['media request','recognition start']);
  assert.equal(f.tracks[0].enabled,true);
});
test('iOS waveform uses byte samples and stays active after final speech and speechend', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  assert.equal(f.byteReads,1); assert.equal(f.floatReads,0);
  assert.deepEqual(f.bars.map(bar=>bar.style.height),['5px','9px','13px','9px','5px']);
  f.recognizers[0].emit('audiostart'); f.recognizers[0].result('21 and 55'); f.recognizers[0].emit('speechend');
  assert.deepEqual([...f.timers.values()].map(t=>t.ms),[30000]);
  assert.equal(f.frames.size,1);
});
test('desktop recognition starts immediately without waiting for the optional meter', async () => {
  const f=voiceFixture({ios:false,deferred:true}); f.controller.startVoiceInput();
  assert.deepEqual(f.order,['recognition start','media request']);
  f.resolveMedia(); await flush();
  assert.equal(f.floatReads,1); assert.equal(f.byteReads,0);
  f.recognizers[0].emit('audiostart'); f.recognizers[0].result('21 and 55');
  assert.ok([...f.timers.values()].some(t=>t.ms===1000));
});
test('the iOS fallback pulse is used only when no held stream is available', async () => {
  for(const meterAvailable of [false,true]) {
    const f=voiceFixture({meterAvailable}); f.controller.startVoiceInput(); await flush();
    assert.equal(f.elements.voiceListenButton.classList.contains('is-meterless'),!meterAvailable);
  }
});
test('manual Stop ends recognition and freezes waveform without stopping the held track', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  f.controller.toggleVoiceListening();
  assert.equal(f.order.at(-1),'recognition stop'); assert.equal(f.frames.size,0);
  assert.equal(f.tracks[0].readyState,'live'); assert.equal(f.tracks[0].enabled,true);
  assert.ok(f.bars.every(bar=>bar.style.height==='2px'));
  f.recognizers[0].emit('end');
  assert.equal(f.timers.size,0); assert.equal(f.tracks[0].readyState,'live');
});
test('iOS retains and reuses the stationary meter after completion and dialog close', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  f.recognizers[0].result('21 and 55'); f.recognizers[0].emit('end'); f.controller.closeVoiceDialog();
  assert.equal(f.frames.size,0); assert.equal(f.timers.size,0); assert.equal(f.tracks[0].enabled,true);
  f.controller.startVoiceInput(); await flush();
  assert.equal(f.tracks.length,1); assert.equal(f.frames.size,1);
  assert.equal(f.order.filter(x=>x==='recognition start').length,2);
});
test('voice changes require review and Apply, preserving the foreground stream', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  f.recognizers[0].result('21 and 55');
  assert.equal(f.state.indoorTemp,24); assert.equal(f.saved,0);
  f.recognizers[0].emit('end'); f.controller.applyVoiceChanges();
  assert.deepEqual(f.state,{indoorTemp:21,indoorRh:55}); assert.equal(f.saved,1);assert.equal(f.renders,1);
  assert.equal(f.tracks[0].readyState,'live'); assert.equal(f.elements.voiceDialog.hidden,true);
});
test('final results and later interim corrections cannot Apply during an active attempt', async () => {
  for (const ios of [false, true]) {
    const f=voiceFixture({ios}); f.controller.startVoiceInput(); await flush();
    f.recognizers[0].result('21 and 55');
    assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.elements.voiceApplyButton.disabled,true);
    assert.equal(f.elements.voiceChanges.children.length,0);
    f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
    f.recognizers[0].result('temperature 90 degrees',false);
    assert.equal(f.elements.voiceStatus.textContent,'Hearing: “temperature 90 degrees”');
    assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.elements.voiceApplyButton.disabled,true);
    f.controller.applyVoiceChanges(); assert.deepEqual(f.state,{indoorTemp:24,indoorRh:58});
    f.recognizers[0].emit('end');
    assert.match(f.elements.voiceStatus.textContent,/Indoor temperature must be between/);
    assert.equal(f.elements.voiceApplyButton.hidden,true); f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
  }
});
test('review uses the latest interim transcript only after recording finishes', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  f.recognizers[0].result('21 and 55'); f.recognizers[0].result('22 degrees Celsius and 60 percent',false);
  f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
  f.recognizers[0].emit('end');
  assert.equal(f.elements.voiceApplyButton.hidden,false); assert.equal(f.elements.voiceApplyButton.disabled,false);
  assert.equal(f.elements.voiceStatus.textContent,'Review the changes before applying.');
  f.controller.applyVoiceChanges(); assert.deepEqual(f.state,{indoorTemp:22,indoorRh:60}); assert.equal(f.saved,1);
  assert.equal(f.tracks[0].readyState,'live');
});
test('Apply stays blocked throughout preparation and Stop, including a final result during cleanup', async () => {
  const f=voiceFixture({deferred:true}); f.controller.startVoiceInput(); f.controller.applyVoiceChanges();
  assert.equal(f.saved,0); assert.equal(f.elements.voiceApplyButton.hidden,true);
  f.resolveMedia(); await flush(); f.recognizers[0].result('21 and 55'); f.controller.toggleVoiceListening();
  assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.elements.voiceApplyButton.disabled,true);
  f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
  f.recognizers[0].result('humidity 60 percent'); f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
  assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.frames.size,0); assert.equal(f.tracks[0].readyState,'live');
  f.recognizers[0].emit('end'); f.controller.applyVoiceChanges();
  assert.deepEqual(f.state,{indoorTemp:24,indoorRh:60}); assert.equal(f.saved,1);
});
test('cleanup timeout completes review without exposing Apply during the pending Stop', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  f.recognizers[0].result('21 and 55'); f.controller.toggleVoiceListening();
  f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
  f.tick(3000);
  assert.equal(f.elements.voiceApplyButton.hidden,false); assert.equal(f.elements.voiceApplyButton.disabled,false);
  assert.equal(f.tracks[0].readyState,'live'); assert.equal(f.frames.size,0);
  f.recognizers[0].result('10 and 20'); f.recognizers[0].emit('end');
  f.controller.applyVoiceChanges(); assert.deepEqual(f.state,{indoorTemp:21,indoorRh:55}); assert.equal(f.saved,1);
});
test('automatic duration timeout waits for recognition cleanup before review', async () => {
  for (const ios of [false,true]) {
    const f=voiceFixture({ios}); f.controller.startVoiceInput(); await flush();
    f.recognizers[0].result('21 and 55'); f.tick(ios?30000:15000);
    assert.equal(f.elements.voiceApplyButton.hidden,true); f.controller.applyVoiceChanges(); assert.equal(f.saved,0);
    f.recognizers[0].emit('end'); assert.equal(f.elements.voiceApplyButton.hidden,false);
    f.controller.applyVoiceChanges(); assert.deepEqual(f.state,{indoorTemp:21,indoorRh:55});
    assert.equal(f.tracks[0].readyState,ios?'live':'ended');
  }
});
test('dismissal and background cancellation cannot leave an applicable draft or accept late results', async () => {
  for (const action of ['closeVoiceDialog','handleVoiceHidden']) {
    const f=voiceFixture(); f.controller.startVoiceInput(); await flush(); f.recognizers[0].result('21 and 55');
    if(action==='handleVoiceHidden') f.document.hidden=true;
    f.controller[action](); f.recognizers[0].result('22 and 60'); f.recognizers[0].emit('end');
    assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.elements.voiceApplyButton.disabled,true);
    f.controller.applyVoiceChanges(); assert.equal(f.saved,0); assert.deepEqual(f.state,{indoorTemp:24,indoorRh:58});
    assert.equal(f.tracks[0].readyState,action==='closeVoiceDialog'?'live':'ended');
  }
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush(); f.recognizers[0].result('21 and 55');
  f.recognizers[0].emit('end'); f.controller.closeVoiceDialog(); f.controller.applyVoiceChanges();
  assert.equal(f.saved,0); assert.equal(f.elements.voiceApplyButton.hidden,true); assert.equal(f.tracks[0].readyState,'live');
});
test('live hearing replaces listening until review, with persistent examples', async () => {
  const f=voiceFixture(); f.controller.startVoiceInput(); await flush();
  assert.equal(f.elements.voiceStatus.textContent,'Listening...');
  f.recognizers[0].result('21 degrees',false);
  assert.equal(f.elements.voiceStatus.textContent,'Hearing: “21 degrees”');
  assert.equal(f.elements.voiceTranscriptPanel.hidden,true); assert.equal(f.elements.voiceExamples.hidden,false);
  f.recognizers[0].emit('end');
  assert.equal(f.elements.voiceStatus.textContent,'Review the changes before applying.');
  assert.equal(f.elements.voiceTranscriptPanel.hidden,false);
});
test('voice examples stay above status and waveform stays inside the dialog', () => {
  const dialog=index.slice(index.indexOf('id="voiceDialog"'));
  assert.doesNotMatch(index.slice(index.indexOf('id="voiceInputButton"'),index.indexOf('id="voiceDialog"')),/voice-waveform/);
  assert.match(dialog,/id="voiceExamples"[^]*?id="voiceStatus"[^]*?id="voiceTranscriptPanel"/);
  assert.match(dialog,/Try “21 degrees, 55 percent” or just “21 and 55”\./);
  assert.match(dialog,/To change one reading, say “Humidity 60 percent”\./);
  assert.match(dialog,/voice-waveform/);
});
test('recognition errors preserve examples and retain the iOS stream after end', async () => {
  const f=voiceFixture();f.controller.startVoiceInput();await flush();
  f.recognizers[0].emit('error',{error:'network'});f.recognizers[0].emit('end');
  assert.equal(f.elements.voiceExamples.hidden,false);assert.equal(f.elements.voiceApplyButton.disabled,true);
  assert.match(f.elements.voiceTranscript.textContent,/unavailable/);assert.equal(f.tracks[0].readyState,'live');
});
test('background and navigation abort recognition before releasing active or retained capture', async () => {
  for(const retained of [false,true]) for(const reason of ['page hidden','page left']) {
    const f=voiceFixture();f.controller.startVoiceInput();await flush();
    if(retained) f.recognizers[0].emit('end');
    f.document.hidden=true;f.controller.handleVoiceHidden(reason);
    assert.equal(f.tracks[0].readyState,'ended');assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
    if(!retained) assert.ok(f.order.indexOf('recognition abort')<f.order.indexOf('track stop'));
  }
});
test('late permission completion after dismissal releases capture and cannot start recognition', async () => {
  const f=voiceFixture({deferred:true});f.controller.startVoiceInput();f.controller.closeVoiceDialog();
  f.resolveMedia();await flush();
  assert.equal(f.tracks[0].readyState,'ended');assert.ok(!f.order.includes('recognition start'));
});
test('stale callbacks from an earlier recognition session cannot replace current results', async () => {
  const f=voiceFixture();f.controller.startVoiceInput();await flush();f.recognizers[0].emit('end');
  f.controller.startVoiceInput();await flush();f.recognizers[1].result('22 and 60');
  f.recognizers[0].result('10 and 20');f.recognizers[0].emit('end');
  assert.equal(f.elements.voiceStatus.textContent,'Hearing: “22 and 60”');assert.equal(f.frames.size,1);
});
test('unsupported browsers expose no voice capability', () => {
  assert.equal(voiceFixture({supported:false}).controller.supported,false);
});
