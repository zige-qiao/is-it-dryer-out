const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChart } = require('../src/ui/chart.js');
const { absoluteHumidity, dewPoint } = require('../src/domain/humidity.js');
const { effectiveAirExchange } = require('../src/domain/ventilation.js');
const state = { indoorTemp: 24, indoorRh: 10, roomPreset: 'medium', openingSetup: 'single' };
const context = createChart({state});
const epoch = Date.UTC(2026,8,27,3,17);
const timeline = Array.from({length:51},(_,hour)=>({time:new Date(epoch+hour*3600000),temp:15,rh:hour===35?90:40,dewPoint:dewPoint(15,hour===35?90:40),pressure:1013.25,wind:hour===32?80:2}));
test('24-hour view retains day-two AH and airflow extremes in both axis scales',()=>{
  const short=context.buildAhOutlook(timeline,24),long=context.buildAhOutlook(timeline,48);
  assert.equal(short.low,long.low);
  assert.equal(short.high,long.high);
  assert.equal(short.achHigh,long.achHigh);
  assert.ok(short.high>absoluteHumidity(15,90));
  assert.ok(short.achHigh>=effectiveAirExchange(state,timeline[32],24).airChangesPerHour);
  assert.equal(short.end-short.start,24*3600000);
  assert.equal(long.end-long.start,48*3600000);
});
test('short forecasts stop at available coverage without fabricating a full 48 hours',()=>{
  const model=context.buildAhOutlook(timeline.slice(0,11),48);
  assert.equal(model.end,epoch+10*3600000);
  assert.equal(model.points.at(-1).time,model.end);
  assert.equal(new Set(model.points.map(p=>p.time)).size,model.points.length);
});
test('fractional forecast endpoints are interpolated once',()=>{
  const model=context.buildAhOutlook(timeline,23.5);
  assert.equal(model.points.at(-1).time,epoch+23.5*3600000);
  assert.ok(Math.abs(model.points.at(-1).value-absoluteHumidity(15,40))<1e-10);
  assert.ok(model.points.every(p=>p.time<=model.end));
});
