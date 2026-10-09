import { clamp, absoluteHumidity, compareMoisture } from '../domain/humidity.js';
import { buildWeatherTimeline as calculateBuildWeatherTimeline, weatherAtTime, buildRainOutlook, rainAtTime } from '../domain/forecast.js';
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
    const left = 0, right = 480, top = 8, bottom = top + 150;
    // Share geometry across loading, failure and live data, including label rows.
    const annotationHeight = state.chartHours === 24 ? 34 * textScale : 0;
    const hourY = bottom + annotationHeight + 16 * textScale;
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
      positionAhIndoorLabel(chart, [], 76, top, bottom);
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
    chart.setAttribute('aria-label', 'Outdoor absolute humidity, forecast rain and estimated airflow with indoor reference; use arrow keys to inspect hourly values');
    const { start, end, points, indoor, low, high: baseHigh, achHigh } = buildAhOutlook(timeline, state.chartHours);
    const high = upperAhBound(chart, indoor, low, baseHigh, top, bottom, textScale);
    const rainOutlook = buildRainOutlook(state.forecast, start, end);
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
    let bars = '', annotations = '';
    const barHours = 2;
    for (let t = start; t < end; t += barHours*3600000) {
      const until = Math.min(end, t+barHours*3600000);
      // Midpoint samples represent each bar's interval; the cursor reads the exact selected time.
      const weather = weatherAtTime(timeline, new Date((t+until)/2));
      const ach = effectiveAirExchange(weather, state.indoorTemp).airChangesPerHour;
      const bx = x(t)+1.5, width = Math.max(1,x(until)-x(t)-3);
      bars += '<rect class="airflow-bar" x="'+bx+'" y="'+ay(ach)+'" width="'+width+'" height="'+(bottom-ay(ach))+'" rx="2"><title>Estimated airflow '+ach.toFixed(1)+' ACH</title></rect>';
      if (state.chartHours === 24 && width > 23) annotations += '<text class="airflow-label" text-anchor="middle" x="'+(bx+width/2)+'" y="'+(bottom+13*textScale)+'">'+ach.toFixed(1)+'</text>';
      if (state.chartHours === 24 && width > 23 && weather.wind > 0 && Number.isFinite(weather.windDirection)) {
        const cx = bx + width / 2, cy = bottom + 25 * textScale;
        // Meteorological bearings describe the source; arrows point with the wind.
        annotations += `<g class="airflow-wind" transform="translate(${cx} ${cy}) scale(${textScale * .7}) rotate(${weather.windDirection + 180})"><title>Wind from ${Math.round(weather.windDirection)}°</title><path d="M-1 -5.8Q0 -7.4 1 -5.8L5.7 4.5Q6.6 6.2 4.8 5.4L.9 3.2Q0 2.7 -.9 3.2L-4.8 5.4Q-6.6 6.2 -5.7 4.5Z"/></g>`;
      }
    }
    const rainHeight = (bottom - top) / 3;
    let rainBands = '', rainBars = '', rainLabels = '';
    for (const spell of rainOutlook.spells) {
      const bx = x(spell.visibleStart), width = x(spell.visibleEnd) - bx;
      rainBands += `<g mask="url(#rainFadeMask)"><rect class="rain-band" x="${bx}" y="${top}" width="${width}" height="${bottom-top}"/><rect x="${bx}" y="${top}" width="${width}" height="${bottom-top}" fill="url(#rainHatch)"/></g>`;
      if (state.chartHours === 24) rainLabels += `<text class="rain-spell-total" text-anchor="middle" x="${bx+width/2}" y="${top+11*textScale}" data-start="${bx}" data-end="${bx+width}">${spell.partial ? '≥ ' : ''}${spell.amount.toFixed(1)} mm</text>`;
    }
    for (const item of rainOutlook.intervals) {
      if (item.amount === null || item.amount <= 0) continue;
      const bx = x(Math.max(start, item.start)), width = x(Math.min(end, item.end)) - bx;
      rainBars += `<rect class="rain-bar" x="${bx+.5}" y="${top}" width="${Math.max(.2,width-1)}" height="${item.amount/rainOutlook.scale*rainHeight}" rx="2"/>`;
    }
    const rainFade = `<linearGradient id="rainFade" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}"><stop offset="0" stop-color="white"/><stop offset=".35" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="rainFadeMask" maskUnits="userSpaceOnUse" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" mask-type="luminance"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="url(#rainFade)"/></mask>`;
    const rainPattern = `<pattern id="rainHatch" width="${7*textScale}" height="${7*textScale}" patternUnits="userSpaceOnUse"><path class="rain-hatch" d="M0 ${7*textScale}L${7*textScale} 0"/></pattern>`;
    chart.innerHTML = '<defs>'+gradient+excessClip+rainFade+rainPattern+'<clipPath id="outlookPlot"><rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'"/></clipPath></defs>'+ticks+days+'<g clip-path="url(#outlookPlot)">'+rainBands+'<path d="'+path+' L'+x(end)+' '+y(indoor)+' L'+left+' '+y(indoor)+'Z" class="ah-excess-fill" clip-path="url(#ahExcessClip)" fill="url(#ahSemantic)" opacity=".09"/>'+bars+rainBars+curve+'</g>'+annotations+rainLabels+hours+'<path d="M'+left+' '+y(indoor)+'H'+right+'" class="ah-indoor-line"/><text class="ah-indoor-label" x="'+(left+4)+'" y="'+(y(indoor)-6)+'">Indoor '+indoor.toFixed(1)+' g/m³</text><path id="ahCursor" class="ah-cursor"/><circle id="ahDot" r="'+(6 * textScale)+'" class="ah-dot"/>';
    placeRainLabels(chart, right, textScale);
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
      const { interval, spell } = rainAtTime(rainOutlook, time);
      const rainLabel = interval?.amount !== null && interval?.amount !== undefined
        ? 'Rain ' + interval.amount.toFixed(1) + ' mm (' + clockFormatter.format(interval.start) + '–' + clockFormatter.format(interval.end) + ')' + (interval.probability !== null ? ' · Precip. chance ' + Math.round(interval.probability) + '%' : '') + (spell ? ' · Spell ' + (spell.partial ? '≥ ' : '') + spell.amount.toFixed(1) + ' mm' : '')
        : 'Rain data unavailable';
      const windLabel = weather.wind > 0 && Number.isFinite(weather.windDirection) ? ' · Wind from '+Math.round(weather.windDirection)+' degrees' : '';
      const label = timeLabel+' · '+moistureLabel+' · '+airflowLabel+windLabel+' · '+rainLabel;
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

  function placeRainLabels(chart, right, textScale) {
    let lastRight = -Infinity;
    for (const label of chart.querySelectorAll('.rain-spell-total')) {
      const width = label.getBBox().width;
      const center = Number(label.getAttribute('x'));
      const start = Number(label.getAttribute('data-start'));
      const end = Number(label.getAttribute('data-end'));
      if (center-width/2 < 0 || center+width/2 > right || width+6*textScale > end-start || center-width/2 < lastRight+6*textScale) label.remove();
      else lastRight = center+width/2;
    }
  }

  function positionAhIndoorLabel(chart, curve, lineY, plotTop = 14, plotBottom = 130) {
    const label = chart.querySelector('.ah-indoor-label');
    const box = label.getBBox();
    const baselineOffset = Number(label.getAttribute('y')) - box.y;
    const textScale = 480 / (chart.getBoundingClientRect?.().width || 480);
    const padding = 4 * textScale; // Four CSS pixels at any rendered chart width.
    const halfStroke = .5 * textScale;
    const lineGap = 6 * textScale;
    const lastX = Math.max(box.x, 480 - padding - box.width);
    const positions = [box.x, lastX];
    const rainLabels = [...chart.querySelectorAll('.rain-spell-total')].map(label => ({ label, box: label.getBBox() }));
    const intersects = (bounds, box) => bounds.left < box.x + box.width && bounds.right > box.x && bounds.top < box.y + box.height && bounds.bottom > box.y;
    const candidates = [lineY - lineGap - box.height, lineY + lineGap].flatMap(top => positions.map(left => {
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
      const rainOverlap = rainLabels.filter(item => intersects(bounds, item.box)).length;
      const valid = top >= plotTop && top + box.height <= plotBottom && left >= 0 && left + box.width <= 480
        && (bounds.bottom <= lineY - halfStroke || bounds.top >= lineY + halfStroke);
      return { left, top, bounds, valid, overlap: overlap + rainOverlap * 1000 };
    }));
    // Keep the label left when clear; otherwise try the chart's right edge.
    // Fall below the reference only when both upper corners are obstructed.
    const eligible = candidates.filter(candidate => candidate.valid);
    const choices = eligible.length ? eligible : candidates;
    const best = choices.find(candidate => candidate.overlap === 0) ||
      choices.reduce((best, candidate) => candidate.overlap < best.overlap ? candidate : best);
    label.setAttribute('x', best.left);
    label.setAttribute('y', best.top + baselineOffset);
    // The indoor reference takes priority if every placement is obstructed.
    // The full rain total remains available through accessible inspection text.
    rainLabels.filter(item => intersects(best.bounds, item.box)).forEach(item => item.label.remove());
  }

  // Measure the same text budget in both ranges, even when 48h hides rain totals.
  // Always start from the full-forecast base bounds, never a previous render.
  function upperAhBound(chart, indoor, low, baseHigh, plotTop, plotBottom, textScale) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('visibility', 'hidden');
    group.setAttribute('aria-hidden', 'true');
    const measure = (className, text, baseline) => {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('class', className);
      label.setAttribute('x', '0');
      label.setAttribute('y', baseline);
      label.textContent = text;
      group.append(label);
      return label;
    };
    const rain = measure('rain-spell-total', '≥ 13.8 mm', plotTop + 11 * textScale);
    const label = measure('ah-indoor-label', `Indoor ${indoor.toFixed(1)} g/m³`, 0);
    chart.append(group);
    const rainBox = rain.getBBox(), indoorBox = label.getBBox();
    group.remove();
    const clearance = 4.5 * textScale; // Includes half the 1px non-scaling reference stroke.
    const boundFor = requiredY => Math.max(baseHigh, Math.ceil(low + (indoor - low) *
      (plotBottom - plotTop) / Math.max(textScale, plotBottom - requiredY)));
    const rainHigh = boundFor(rainBox.y + rainBox.height + clearance);
    const lineY = plotBottom - (indoor - low) / (rainHigh - low) * (plotBottom - plotTop);
    const aboveFits = lineY - 6 * textScale - indoorBox.height >= plotTop + 4 * textScale;
    const belowFits = lineY + 6 * textScale + indoorBox.height <= plotBottom - 4 * textScale;
    // Add more only if the Indoor label cannot fit on either side of the line.
    return aboveFits || belowFits ? rainHigh : Math.max(rainHigh,
      boundFor(plotTop + indoorBox.height + 10 * textScale));
  }

  return { buildAhOutlook, renderAhChart, positionAhIndoorLabel };
}
