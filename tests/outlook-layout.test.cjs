const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const context = {
  state: { indoorTemp: 24, indoorRh: 10 },
  absoluteHumidity: (_temp, rh) => rh,
  effectiveAirExchange: weather => ({ airChangesPerHour: weather.wind }),
  weatherAtTime: (timeline, time) => {
    let b = timeline.findIndex(p => p.time >= time);
    if (b <= 0) return { ...timeline[Math.max(0,b)], time };
    const a=timeline[b-1], next=timeline[b], f=(time-a.time)/(next.time-a.time);
    return { time, temp: 15, rh:a.rh+(next.rh-a.rh)*f, wind:a.wind+(next.wind-a.wind)*f };
  },
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function buildAhOutlook('),source.indexOf('function renderAhChart(')),context);
const epoch = Date.UTC(2026,8,27,3,17);
const timeline = Array.from({length:51},(_,hour)=>({time:new Date(epoch+hour*3600000),temp:15,rh:hour===35?18:8,wind:hour===32?8:2}));
test('24-hour view retains day-two AH and airflow extremes in both axis scales',()=>{
  const short=context.buildAhOutlook(timeline,24),long=context.buildAhOutlook(timeline,48);
  assert.equal(short.low,long.low);
  assert.equal(short.high,long.high);
  assert.equal(short.achHigh,long.achHigh);
  assert.ok(short.high>18);
  assert.ok(short.achHigh>=8);
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
  assert.equal(model.points.at(-1).value,8);
  assert.ok(model.points.every(p=>p.time<=model.end));
});
