const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildForecast, buildRainOutlook, rainAtTime, weatherAtTime, normalizeWindDirection } = require('../src/domain/forecast.js');
const { createWeatherController } = require('../src/services/weather.js');
const H = 3600000, start = Date.UTC(2026, 9, 8, 12);
const forecast = amounts => amounts.map((rainfall, i) => ({ time: new Date(start + i * H), rainfall, precipitationProbability: 60 }));

test('weather request includes liquid rain, showers and precipitation probability', () => {
  const controller = createWeatherController({state: {location: {latitude: 53, longitude: -2}}});
  const hourly = new URL(controller.weatherUrlForLocation()).searchParams.get('hourly');
  assert.match(hourly, /rain,showers,precipitation_probability/);
});
test('forecast combines rain and showers but does not invent missing or invalid values', () => {
  const hourly = {time: [start/1000, start/1000+3600, start/1000+7200], temperature_2m: [10,10,10], relative_humidity_2m: [70,70,70], dew_point_2m: [5,5,5], rain: [.5,1,-1], showers: [.2,null,1], precipitation_probability: [80,101,null]};
  const result = buildForecast({hourly});
  assert.equal(result[0].rainfall, .7);
  assert.equal(result[1].rainfall, null);
  assert.equal(result[2].rainfall, null);
  assert.equal(result[0].precipitationProbability, 80);
  assert.equal(result[1].precipitationProbability, null);
});
test('hourly rainfall belongs to the preceding hour and is not interpolated', () => {
  const model = buildRainOutlook(forecast([0, 2, 0]), start, start+2*H);
  assert.equal(rainAtTime(model,start+H/2).interval.amount,2);
  assert.equal(rainAtTime(model,start+H).interval.amount,0);
  assert.equal(rainAtTime(model,start+2*H).interval.amount,0);
  assert.equal(rainAtTime(model,start+3*H).interval,undefined);
});
test('dry hours and missing data break spells; known totals survive clipping without prorating', () => {
  const model = buildRainOutlook(forecast([0,1,2,0,3,null,4,0]), start+H/2, start+6*H);
  assert.equal(model.spells.length,3);
  assert.equal(model.spells[0].amount,2);
  assert.equal(model.spells[0].visibleStart,start+H/2);
  assert.equal(model.spells[0].partial,true);
  assert.equal(model.spells[1].partial,true);
  assert.equal(model.spells[2].partial,true);
  assert.equal(rainAtTime(model,start+4.5*H).interval.amount,null);
});
test('both chart ranges share day-two rain extremes; absent rain stays unavailable', () => {
  const values=Array(50).fill(0); values[35]=4.2;
  const data=forecast(values);
  assert.equal(buildRainOutlook(data,start,start+24*H).scale,5);
  assert.equal(buildRainOutlook(data,start,start+48*H).scale,5);
  assert.equal(buildRainOutlook(forecast([null,null]),start,start+H).spells.length,0);
});

test('wind bearings wrap through north and preserve missing directions', () => {
  const point = (hour, windDirection) => ({time:new Date(start+hour*H),temp:10,dewPoint:5,pressure:1013,wind:8,windDirection});
  assert.equal(weatherAtTime([point(0,350),point(2,10)],new Date(start+H)).windDirection,0);
  assert.equal(weatherAtTime([point(0,10),point(2,350)],new Date(start+H)).windDirection,0);
  assert.equal(weatherAtTime([point(0,null),point(2,90)],new Date(start+H)).windDirection,null);
  assert.equal(weatherAtTime([point(0,null),point(2,90)],new Date(start+2*H)).windDirection,90);
  assert.equal(normalizeWindDirection(360),0);
  for (const invalid of [null,undefined,-1,361,NaN]) assert.equal(normalizeWindDirection(invalid),null);
  const url = new URL(createWeatherController({state:{location:{latitude:53,longitude:-2}}}).weatherUrlForLocation());
  for (const field of ['current','hourly']) assert.match(url.searchParams.get(field),/wind_direction_10m/);
});
