import { clamp } from '../domain/humidity.js';

export function createReadingControls({
  state,
  elements,
  saveIndoorReadings,
  savePlanSettings,
  render,
} = {}, environment = globalThis) {
  const { window, document, Date, performance, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, ResizeObserver, Event } = environment;

  function bindTypedValue(input, stateKey, min, max, save) {
    const applyValue = () => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || value < min || value > max) return false;
      state[stateKey] = ["indoorTemp", "indoorRh", "minTemp", "targetRh"].includes(stateKey)
        ? rulerValueFromDrag(value, 0, min, max, Number(input.step), 1) : value;
      input.value = stateKey === "indoorTemp" ? state[stateKey].toFixed(1) : state[stateKey];
      save();
      render();
      return true;
    };
    input.addEventListener("change", () => {
      if (!applyValue()) { input.value = stateKey === "indoorTemp" ? state[stateKey].toFixed(1) : state[stateKey]; render(); }
    });
  }

  function bindSteppers() {
    const settings = {
      indoorTemp: { min: 10, max: 32, step: 0.1, save: saveIndoorReadings },
      indoorRh: { min: 20, max: 90, step: 1, save: saveIndoorReadings },
      targetRh: { min: 40, max: 65, step: 1, save: savePlanSettings },
      minTemp: { min: 16, max: 26, step: 1, save: savePlanSettings },
    };

    document.querySelectorAll(".step-button").forEach((button) => {
      const stateKey = button.dataset.stepTarget;
      const setting = settings[stateKey];
      const direction = Number(button.dataset.stepDirection);
      if (!setting || !Number.isFinite(direction)) return;

      let repeatDelay;
      let repeatTimer;
      let repeated = false;

      const applyStep = () => {
        const precision = setting.step < 1 ? 1 : 0;
        state[stateKey] = Number(
          clamp(state[stateKey] + setting.step * direction, setting.min, setting.max).toFixed(precision),
        );
        setting.save();
        render();
      };

      const stopRepeating = () => {
        clearTimeout(repeatDelay);
        clearInterval(repeatTimer);
      };

      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        repeated = false;
        repeatDelay = setTimeout(() => {
          repeated = true;
          applyStep();
          repeatTimer = setInterval(applyStep, 110);
        }, 450);
      });
      button.addEventListener("pointerup", stopRepeating);
      button.addEventListener("pointercancel", stopRepeating);
      button.addEventListener("pointerleave", stopRepeating);
      button.addEventListener("click", () => {
        if (!repeated) applyStep();
      });
    });
  }

  function rulerValueFromDrag(start, distance, min, max, step, spacing) {
    return Number(Math.min(max, Math.max(min, Math.round((start - distance / spacing * step) / step) * step)).toFixed(step < 1 ? 1 : 0));
  }

  function renderReadingRulers() {
    document.querySelectorAll('[data-ruler]').forEach(ruler => {
      const input = ruler.querySelector('input');
      const value = state[ruler.dataset.ruler];
      const step = Number(input.step), spacing = Number(ruler.dataset.tickSpacing);
      const majorEvery = Math.round(Number(ruler.dataset.majorInterval) / step);
      const centre = value / step;
      const radius = Math.ceil((ruler.clientWidth || 440) / (2 * spacing)) + 1;
      let ticks = '';
      for (let tick = Math.floor(centre) - radius; tick <= Math.ceil(centre) + radius; tick++) {
        const number = Number((tick * step).toFixed(1));
        if (number < Number(input.min) || number > Number(input.max)) continue;
        const major = tick % majorEvery === 0;
        ticks += '<span class="ruler-tick' + (major ? ' ruler-tick-major' : '') + '" style="left:calc(50% + ' + ((tick - centre) * spacing).toFixed(2) + 'px)">' + (major && Math.abs((tick - centre) * spacing) > 16 ? '<span>' + number + '</span>' : '') + '</span>';
      }
      ruler.querySelector('.ruler-ticks').innerHTML = ticks;
      input.setAttribute('aria-valuetext', value + ' ' + ruler.dataset.unit);
    });
    updateIndoorLastSetLabels();
  }

  function updateIndoorLastSetLabels() {
    const lastSet = document.querySelector('#indoorLastSet');
    const summaryLastSet = document.querySelector('#indoorSummaryLastSet');
    lastSet.hidden = !state.indoorLastSet;
    summaryLastSet.hidden = !state.indoorLastSet;
    if (!state.indoorLastSet) return;

    const minutes = Math.max(0, Math.floor((Date.now() - state.indoorLastSet) / 60_000));
    const elapsed = minutes === 0 ? 'Just now'
      : minutes < 60 ? `${minutes}m ago`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
    lastSet.textContent = state.indoorReadingSource === 'photo' ? `From photo · ${elapsed.toLowerCase()}` : elapsed;
    summaryLastSet.textContent = `· ${elapsed}`;
    const absoluteTime = new Date(state.indoorLastSet).toLocaleString();
    lastSet.title = absoluteTime;
    summaryLastSet.title = absoluteTime;
  }

  function bindReadingRulers() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.querySelectorAll('[data-ruler]').forEach(ruler => {
      const dialog = ruler.closest('dialog');
      const input = ruler.querySelector('input');
      const step = Number(input.step), spacing = Number(ruler.dataset.tickSpacing);
      let gesture = null, frame = null;
      const stopCoast = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      };
      const reset = () => {
        stopCoast();
        const id = gesture?.id;
        gesture = null;
        ruler.classList.remove('is-dragging');
        if (id !== undefined && ruler.hasPointerCapture(id)) ruler.releasePointerCapture(id);
      };
      const applyDistance = (start, distance) => {
        const next = rulerValueFromDrag(start, distance, Number(input.min), Number(input.max), step, spacing);
        if (Number(input.value) !== next) {
          input.value = next;
          input.dispatchEvent(new Event('input', {bubbles:true}));
        }
        return next;
      };
      const coast = velocity => {
        if (reducedMotion.matches || Math.abs(velocity) < .25) return;
        // At most 120px of extra travel over 450ms, with no bounce or overshoot.
        const distance = Math.sign(velocity) * Math.min(120, Math.abs(velocity) * 180);
        const value = Number(input.value), started = performance.now();
        const tick = now => {
          frame = null;
          const progress = Math.min(1, Math.max(0, (now - started) / 450));
          const next = applyDistance(value, distance * (1 - Math.pow(1 - progress, 3)));
          const atLimit = distance > 0 ? next <= Number(input.min) : next >= Number(input.max);
          if (progress < 1 && !atLimit) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      };
      ruler.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        reset();
        input.focus({preventScroll:true});
        gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value),dragging:false,samples:[{x:event.clientX,time:event.timeStamp}]};
        ruler.setPointerCapture(event.pointerId);
      });
      ruler.addEventListener('pointermove', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (!gesture.dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 4) { reset(); return; }
        if (!gesture.dragging && Math.abs(dx) < 4) return;
        gesture.dragging = true;
        ruler.classList.add('is-dragging');
        gesture.samples.push({x:event.clientX,time:event.timeStamp});
        while (gesture.samples.length > 2 && gesture.samples[1].time < event.timeStamp - 80) gesture.samples.shift();
        applyDistance(gesture.value, dx);
      });
      ruler.addEventListener('pointerup', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const first = gesture.samples[0], last = gesture.samples.at(-1);
        const elapsed = event.timeStamp - first.time;
        const velocity = gesture.dragging && event.timeStamp - last.time < 80 && elapsed > 0 && elapsed <= 160
          ? (last.x - first.x) / elapsed : 0;
        reset();
        coast(velocity);
      });
      ruler.addEventListener('pointercancel', reset);
      ruler.addEventListener('lostpointercapture', () => { if (gesture) reset(); });
      dialog.addEventListener('close', reset);
      dialog.addEventListener('pointerdown', stopCoast);
      dialog.addEventListener('keydown', stopCoast);
      document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
      window.addEventListener('pagehide', reset);
      reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) reset(); });
      new ResizeObserver(renderReadingRulers).observe(ruler);
    });
    [elements.indoorTempInput,elements.indoorRhInput,elements.minTempInput,elements.targetRhInput].forEach(input => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
      });
    });
  }

  return { bindTypedValue, bindSteppers, rulerValueFromDrag, renderReadingRulers, updateIndoorLastSetLabels, bindReadingRulers };
}
