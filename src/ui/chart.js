import { clamp, absoluteHumidity, compareMoisture } from '../domain/humidity.js';
import { buildWeatherTimeline as calculateBuildWeatherTimeline, weatherAtTime } from '../domain/forecast.js';
import { effectiveAirExchange as calculateEffectiveAirExchange } from '../domain/ventilation.js';

export function createChart({
  state,
  formatShortTime,
} = {}, environment = globalThis) {
  const { window, document, Date, getComputedStyle } = environment;
  const buildWeatherTimeline = (...args) => calculateBuildWeatherTimeline(state, ...args);
  const effectiveAirExchange = (...args) => calculateEffectiveAirExchange(state, ...args);
  const semanticPosition = weather => {
    const comparison = compareMoisture(state.indoorTemp, state.indoorRh, weather.temp, weather.rh);
    return clamp(0.5 + comparison.difference / (comparison.margin * 3.5), 0, 1);
  };
  const nearStart = 0.2142857143, nearEnd = 0.7857142857;
  // Intl formatters are costly to construct; reuse them until the timezone changes.
  let formatterZone = null, dayFormatter, clockFormatter;
  function chartFormatters() {
    if (formatterZone !== state.timezone) {
      formatterZone = state.timezone;
      dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, weekday: 'short' });
      clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }
    return { dayFormatter, clockFormatter };
  }
  function semanticColor(position, wet, near) {
    const rgb = value => {
      const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
      return hex ? [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) : [255, 255, 255];
    };
    const from = rgb(position < nearStart ? wet : near);
    const to = rgb(position < nearStart ? near : '#ffffff');
    const fraction = position < nearStart ? position / nearStart
      : position <= nearEnd ? 0 : (position - nearEnd) / (1 - nearEnd);
    return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * fraction)).join(', ')})`;
  }
  function buildAhOutlook(timeline, hours) {
    const start = timeline[0].time.getTime();
    const fullEnd = Math.min(start + 48 * 3600000, timeline.at(-1).time.getTime());
    const end = Math.min(start + hours * 3600000, fullEnd);
    const sample = weather => ({ time: weather.time.getTime(), value: absoluteHumidity(weather.temp, weather.rh), ach: effectiveAirExchange(weather, state.indoorTemp).airChangesPerHour, semantic: semanticPosition(weather) });
    const full = timeline.filter(p => p.time.getTime() < fullEnd).map(sample);
    full.push(sample(weatherAtTime(timeline, new Date(fullEnd))));
    const points = full.filter(p => p.time < end);
    points.push(sample(weatherAtTime(timeline, new Date(end))));
    const indoor = absoluteHumidity(state.indoorTemp, state.indoorRh);
    const low = Math.max(0, Math.floor(Math.min(indoor, ...full.map(p => p.value)) - 1));
    const high = Math.ceil(Math.max(indoor, ...full.map(p => p.value)) + 1);
    const achHigh = Math.max(3, Math.ceil(Math.max(...full.map(p => p.ach)) * 1.1));
    return { start, end, points, indoor, low, high, achHigh };
  }

  function renderAhChart() {
    const chart = document.querySelector('#ahChart');
    const reading = document.querySelector('#ahChartReading');
    if (!chart || !reading) return;
    // SVG text scales with the viewBox; cancel that scale to retain CSS-pixel type sizes.
    const chartWidth = chart.getBoundingClientRect().width;
    const textScale = chartWidth > 0 ? 480 / chartWidth : 1;
    chart.style.setProperty('--chart-text-scale', String(textScale));
    const left = 0, right = 480, top = 8, bottom = 158;
    // Share geometry across loading, failure and live data, including label rows.
    const hourY = bottom + 16 * textScale;
    const dayY = hourY + 18 * textScale;
    const labelBottom = dayY + 7 * textScale;
    chart.setAttribute('viewBox', '0 0 480 ' + labelBottom);
    const timeline = buildWeatherTimeline();
    const unavailable = timeline.length < 2 || state.weatherRequestPending || state.weatherLoadFailed;
    document.querySelectorAll('[data-chart-hours]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.chartHours) === state.chartHours));
      button.disabled = unavailable;
    });
    chart.dataset.weatherState = unavailable ? (state.weatherLoadFailed ? 'failed' : 'loading') : 'ready';
    if (unavailable) {
      chart.classList.remove('is-pointer-inspecting');
      const indoor = absoluteHumidity(state.indoorTemp, state.indoorRh);
      // These shapes are placeholders, not a scale or estimates of outdoor weather.
      const heights = [22, 25, 25, 28, 27, 26, 25, 22, 21, 20, 21, 22];
      const bars = heights.map((height, i) => `<rect class="ah-skeleton-bar" x="${i * 40 + 1.5}" y="${bottom - height}" width="37" height="${height}" rx="2"/>`).join('');
      const grid = [150, 270, 390].map(x => `<path class="ah-day-line" d="M${x} ${top}V${labelBottom}"/>`).join('');
      const placeholders = [4, 154, 274, 394].map((x, i) => `<rect class="ah-skeleton-label" x="${x}" y="${hourY - 7 * textScale}" width="${(i === 0 ? 30 : 19) * textScale}" height="${9 * textScale}" rx="${4.5 * textScale}"/>` + (i === 0 || i === 3 ? `<rect class="ah-skeleton-label" x="${x}" y="${dayY - 7 * textScale}" width="${28 * textScale}" height="${9 * textScale}" rx="${4.5 * textScale}"/>` : '')).join('');
      const shimmer = state.weatherLoadFailed ? '' : `<defs><linearGradient id="ahSkeletonShimmer"><stop stop-color="white" stop-opacity="0"/><stop offset=".5" stop-color="white" stop-opacity=".055"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><clipPath id="ahSkeletonClip"><rect width="480" height="${labelBottom}" rx="5"/></clipPath></defs><g clip-path="url(#ahSkeletonClip)" aria-hidden="true"><g transform="skewX(-18)"><rect class="ah-skeleton-shimmer" x="-280" width="280" height="${labelBottom}" fill="url(#ahSkeletonShimmer)"/></g></g>`;
      chart.innerHTML = `<g class="ah-skeleton" aria-hidden="true">${grid}<path class="ah-grid" d="M0 ${bottom}H480 M0 124H480"/>${bars}${placeholders}<path class="ah-indoor-line" d="M0 76H480"/><text class="ah-indoor-label" x="4" y="70">Indoor ${indoor.toFixed(1)} g/m³</text></g>${shimmer}`;
      chart.setAttribute('role', 'img');
      chart.setAttribute('tabindex', '-1');
      chart.setAttribute('aria-label', `${state.weatherLoadFailed ? 'Outdoor forecast unavailable' : 'Loading outdoor forecast'}. Indoor ${indoor.toFixed(1)} g/m³. Chart shapes are placeholders.`);
      chart.setAttribute('aria-disabled', 'true');
      ['aria-valuetext', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow'].forEach(name => chart.removeAttribute(name));
      chart.onpointerdown = chart.onpointermove = chart.onkeydown = null;
      reading.textContent = state.weatherLoadFailed ? 'Outdoor forecast unavailable' : 'Loading outdoor forecast…';
      return;
    }
    chart.removeAttribute('aria-disabled');
    chart.setAttribute('role', 'slider');
    chart.setAttribute('tabindex', '0');
    chart.setAttribute('aria-valuemin', '0');
    chart.setAttribute('aria-label', 'Outdoor absolute humidity and estimated airflow with indoor reference; use arrow keys to inspect hourly values');
    const { start, end, points, indoor, low, high, achHigh } = buildAhOutlook(timeline, state.chartHours);
    const x = time => left + (time - start) / (end - start) * (right - left);
    const y = value => bottom - (value - low) / (high - low) * (bottom - top);
    const airflowBandHeight = (bottom - top) / 3;
    const ay = ach => bottom - ach / achHigh * airflowBandHeight;
    const chartStyles = getComputedStyle(chart);
    const wetColor = chartStyles.getPropertyValue('--chart-wet').trim() || '#ffb3a8';
    const nearColor = chartStyles.getPropertyValue('--chart-near').trim() || '#ffd27a';
    const semanticSamples = [];
    for (let time = start; time < end; time += 15 * 60000) {
      semanticSamples.push({ time, position: semanticPosition(weatherAtTime(timeline, new Date(time))) });
    }
    semanticSamples.push({ time: end, position: semanticPosition(weatherAtTime(timeline, new Date(end))) });
    const gradientSamples = [semanticSamples[0]];
    for (let index = 1; index < semanticSamples.length; index += 1) {
      const previous = semanticSamples[index - 1], next = semanticSamples[index];
      for (const threshold of [nearStart, nearEnd]) {
        if ((previous.position - threshold) * (next.position - threshold) >= 0) continue;
        let low = previous.time, high = next.time;
        const increasing = next.position > previous.position;
        for (let step = 0; step < 16; step += 1) {
          const middle = (low + high) / 2;
          const position = semanticPosition(weatherAtTime(timeline, new Date(middle)));
          if ((position < threshold) === increasing) low = middle;
          else high = middle;
        }
        gradientSamples.push({ time: (low + high) / 2, position: threshold });
      }
      gradientSamples.push(next);
    }
    gradientSamples.sort((a, b) => a.time - b.time);
    const gradientStops = gradientSamples.map(sample => '<stop offset="'+((sample.time-start)/(end-start))+'" stop-color="'+semanticColor(sample.position, wetColor, nearColor)+'"/>').join('');
    const gradient = '<linearGradient id="ahSemantic" gradientUnits="userSpaceOnUse" x1="'+left+'" y1="0" x2="'+right+'" y2="0">'+gradientStops+'</linearGradient>';
    const excessClip = '<clipPath id="ahExcessClip"><rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+Math.max(0,y(indoor)-top)+'"/></clipPath>';
    const path = points.map((p,i) => (i ? 'L' : 'M')+x(p.time).toFixed(2)+','+y(p.value).toFixed(2)).join(' ');
    // Draw one continuous stroke at twice the previous bitmap resolution, then
    // display it at the same size. This avoids the iOS SVG gradient repaint issue.
    const curveCanvas = document.createElement('canvas');
    const displayWidth = chartWidth || 480;
    const rasterScale = Math.max(2, Math.min(4, 2 * (window.devicePixelRatio || 1)));
    curveCanvas.width = Math.ceil(displayWidth * rasterScale);
    curveCanvas.height = Math.ceil((bottom - top) / 480 * displayWidth * rasterScale);
    const curveContext = curveCanvas.getContext('2d');
    let curve = '<path d="'+path+'" class="ah-curve"/>';
    if (curveContext) {
      curveContext.scale(curveCanvas.width / 480, curveCanvas.height / (bottom - top));
      curveContext.translate(0, -top);
      const lineGradient = curveContext.createLinearGradient(left, 0, right, 0);
      gradientSamples.forEach(sample => lineGradient.addColorStop((sample.time-start)/(end-start), semanticColor(sample.position, wetColor, nearColor)));
      curveContext.beginPath();
      points.forEach((point, i) => i ? curveContext.lineTo(x(point.time), y(point.value)) : curveContext.moveTo(x(point.time), y(point.value)));
      curveContext.strokeStyle = lineGradient;
      curveContext.lineWidth = 2.5 * textScale;
      curveContext.lineJoin = 'round';
      curveContext.lineCap = 'round';
      curveContext.stroke();
      curve = '<image x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'" href="'+curveCanvas.toDataURL('image/png')+'" aria-hidden="true"/>';
    }
    const ticks = '<path d="M'+left+' '+bottom+'H'+right+'" class="ah-grid"/>';
    const { dayFormatter, clockFormatter } = chartFormatters();
    const step = state.chartHours === 24 ? 6 : 12;
    const clockTicks = timeline.filter(p => p.time.getTime() > start && p.time.getTime() <= end)
      .map(p => ({ time: p.time.getTime(), clock: clockFormatter.format(p.time) }))
      .filter(p => p.clock.endsWith(':00') && Number(p.clock.slice(0,2)) % step === 0);
    const firstMidnight = clockTicks.find(p => p.clock === '00:00');
    let days = !firstMidnight || x(firstMidnight.time) > left+50 ? '<text class="chart-time-label" x="'+left+'" y="'+dayY+'">'+dayFormatter.format(start)+'</text>' : '';
    let hours = '<text class="chart-time-label" x="'+left+'" y="'+hourY+'">Now</text>';
    for (const tick of clockTicks) {
      const px = x(tick.time);
      const labelX = Math.min(px+6, right-34);
      days += '<path d="M'+px+' '+top+'V'+labelBottom+'" class="ah-day-line"/>';
      if (px >= left+50) hours += '<text class="chart-time-label" x="'+labelX+'" y="'+hourY+'">'+tick.clock.slice(0,2)+'</text>';
      if (tick.clock === '00:00') days += '<text class="chart-time-label" x="'+labelX+'" y="'+dayY+'">'+dayFormatter.format(tick.time)+'</text>';
    }
    let bars = '';
    const barHours = 2;
    for (let t = start; t < end; t += barHours*3600000) {
      const until = Math.min(end, t+barHours*3600000);
      // Midpoint samples represent each bar's interval; the cursor reads the exact selected time.
      const ach = effectiveAirExchange(weatherAtTime(timeline, new Date((t+until)/2)), state.indoorTemp).airChangesPerHour;
      const bx = x(t)+1.5, width = Math.max(1,x(until)-x(t)-3);
      bars += '<rect class="airflow-bar" x="'+bx+'" y="'+ay(ach)+'" width="'+width+'" height="'+(bottom-ay(ach))+'" rx="2"><title>Estimated airflow '+ach.toFixed(1)+' ACH</title></rect>';
      if (state.chartHours === 24 && width > 23 && bottom-ay(ach) > 16 * textScale) bars += '<text class="airflow-label" text-anchor="middle" x="'+(bx+width/2)+'" y="'+(ay(ach)+13*textScale)+'">'+ach.toFixed(1)+'</text>';
    }
    chart.innerHTML = '<defs>'+gradient+excessClip+'<clipPath id="outlookPlot"><rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'"/></clipPath></defs>'+ticks+days+'<g clip-path="url(#outlookPlot)"><path d="'+path+' L'+x(end)+' '+y(indoor)+' L'+left+' '+y(indoor)+'Z" class="ah-excess-fill" clip-path="url(#ahExcessClip)" fill="url(#ahSemantic)" opacity=".09"/>'+bars+curve+'</g>'+hours+'<path d="M'+left+' '+y(indoor)+'H'+right+'" class="ah-indoor-line"/><text class="ah-indoor-label" x="'+(left+4)+'" y="'+(y(indoor)-6)+'">Indoor '+indoor.toFixed(1)+' g/m³</text><path id="ahCursor" class="ah-cursor"/><circle id="ahDot" r="'+(6 * textScale)+'" class="ah-dot"/>';
    reading.innerHTML = '<span class="ah-reading-time"></span> · <span class="ah-reading-moisture"></span> · <span class="ah-reading-airflow"></span>';
    const readingTime = reading.querySelector('.ah-reading-time');
    const readingMoisture = reading.querySelector('.ah-reading-moisture');
    const readingAirflow = reading.querySelector('.ah-reading-airflow');
    positionAhIndoorLabel(chart, points.map(p => ({ x:x(p.time), y:y(p.value) })), y(indoor), top, bottom);
    let selected = 0;
    const maxHours = (end-start)/3600000;
    chart.setAttribute('aria-valuemax', maxHours.toFixed(2));
    function select(hours) {
      selected = clamp(hours,0,maxHours);
      state.chartSelection = selected;
      const time = start+selected*3600000;
      const weather = weatherAtTime(timeline,new Date(time));
      const value = absoluteHumidity(weather.temp,weather.rh);
      const ach = effectiveAirExchange(weather,state.indoorTemp).airChangesPerHour;
      const timeLabel = selected === 0 ? 'Now' : dayFormatter.format(time)+' '+formatShortTime(new Date(time));
      const moistureLabel = value.toFixed(1)+' g/m³';
      const airflowLabel = ach.toFixed(1)+' ACH';
      const label = timeLabel+' · '+moistureLabel+' · '+airflowLabel;
      chart.setAttribute('aria-valuenow',selected.toFixed(2));
      chart.setAttribute('aria-valuetext',label);
      chart.querySelector('#ahCursor').setAttribute('d','M'+x(time)+' '+top+'V'+bottom);
      chart.querySelector('#ahDot').setAttribute('cx',x(time));
      // Follow the displayed curve exactly between forecast samples.
      const next = Math.max(1,points.findIndex(p=>p.time>=time));
      const b=points[next], a=points[next-1];
      const fraction=b.time===a.time ? 0 : (time-a.time)/(b.time-a.time);
      const curveValue = a.value+(b.value-a.value)*fraction;
      chart.querySelector('#ahDot').setAttribute('cy',y(curveValue));
      const nextColor = Math.max(1, gradientSamples.findIndex(sample => sample.time >= time));
      const first = gradientSamples[nextColor - 1], second = gradientSamples[nextColor];
      const colorFraction = second.time === first.time ? 0 : clamp((time - first.time) / (second.time - first.time), 0, 1);
      const colorChannels = sample => semanticColor(sample.position, wetColor, nearColor).match(/\d+/g).map(Number);
      const fromColor = colorChannels(first), toColor = colorChannels(second);
      readingTime.textContent = timeLabel;
      readingMoisture.textContent = moistureLabel;
      readingAirflow.textContent = airflowLabel;
      readingMoisture.style.color = `rgb(${fromColor.map((channel, index) => Math.round(channel + (toColor[index] - channel) * colorFraction)).join(', ')})`;
    }
    const inspect = event => {
      const bounds=chart.getBoundingClientRect();
      select(((event.clientX-bounds.left)/bounds.width*480-left)/(right-left)*maxHours);
    };
    chart.onpointerdown = event => { chart.classList.add('is-pointer-inspecting'); chart.setPointerCapture(event.pointerId); inspect(event); };
    chart.onpointermove = event => { if(chart.hasPointerCapture(event.pointerId)||event.pointerType==='mouse') inspect(event); };
    chart.onblur = () => chart.classList.remove('is-pointer-inspecting');
    chart.onkeydown = event => {
      chart.classList.remove('is-pointer-inspecting');
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      select(event.key==='Home' ? 0 : event.key==='End' ? maxHours : selected+(event.key==='ArrowRight'?1:-1));
    };
    select(state.chartSelection);
  }

  function positionAhIndoorLabel(chart, curve, lineY, plotTop = 14, plotBottom = 130) {
    const label = chart.querySelector('.ah-indoor-label');
    const box = label.getBBox();
    const baselineOffset = Number(label.getAttribute('y')) - box.y;
    const padding = 4; // Keep a little clear space around the text and curve.
    const lastX = Math.max(box.x, 480 - padding - box.width);
    const positions = [box.x, lastX];
    const candidates = [lineY - 6 - box.height, lineY + 6].flatMap(top => positions.map(left => {
      top = clamp(top, plotTop + padding, plotBottom - padding - box.height);
      const bounds = { left: left - padding, right: left + box.width + padding,
        top: top - padding, bottom: top + box.height + padding };
      let overlap = 0;
      // Measure curve length inside the padded label rectangle, including segments
      // whose endpoints both lie outside it.
      for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1];
        const b = curve[i];
        let enter = 0;
        let leave = 1;
        for (const [origin, delta, min, max] of [
          [a.x, b.x - a.x, bounds.left, bounds.right],
          [a.y, b.y - a.y, bounds.top, bounds.bottom],
        ]) {
          if (delta === 0) {
            if (origin < min || origin > max) leave = -1;
          } else {
            const t1 = (min - origin) / delta;
            const t2 = (max - origin) / delta;
            enter = Math.max(enter, Math.min(t1, t2));
            leave = Math.min(leave, Math.max(t1, t2));
          }
        }
        overlap += Math.max(0, leave - enter) * Math.hypot(b.x - a.x, b.y - a.y);
      }
      return { left, top, overlap };
    }));
    // Keep the label left when clear; otherwise try the chart's right edge.
    // Fall below the reference only when both upper corners are obstructed.
    const best = candidates.find(candidate => candidate.overlap === 0) ||
      candidates.reduce((best, candidate) => candidate.overlap < best.overlap ? candidate : best);
    label.setAttribute('x', best.left);
    label.setAttribute('y', best.top + baselineOffset);
  }

  return { buildAhOutlook, renderAhChart, positionAhIndoorLabel };
}
