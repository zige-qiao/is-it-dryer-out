import { processImage } from './worker.js';
import { boundedRegion, mapRegionalResult, mergeResults, humiditySearchRegion } from './regions.js';
import { remapHypotheses } from './orientation.js';
import { createRecognitionBudget, RECOGNITION_LIMIT_MS } from './budget.js';
import { mapRowContexts, validateRowCells, dedupeRowContexts } from './row-context.js';
import { inverse, projectBox, IDENTITY } from './geometry.js';

export { RECOGNITION_LIMIT_MS } from './budget.js';

export function cropCanvas(source, crop, document = globalThis.document) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * crop.width));
  canvas.height = Math.max(1, Math.round(source.height * crop.height));
  canvas.getContext('2d').drawImage(source, source.width * crop.x, source.height * crop.y,
    source.width * crop.width, source.height * crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function createRecognitionService(environment = globalThis) {
  let generation = 0, current = null;
  const now = () => environment.performance?.now() ?? Date.now();
  function cancel() {
    generation++;
    current?.finish(null);
  }
  function analyze(source, options = {}) {
    const deadline = now() + RECOGNITION_LIMIT_MS;
    cancel();
    const id = generation, sourceSize = { width: source.width, height: source.height };
    return new Promise((resolve, reject) => {
      let worker = null, settled = false, stageId = 0, stageResolve = null, stageReject = null;
      let stageMap = value => value, partial = null;
      const results = [];
      let rowContexts = null;
      let credibleDisplayIds = [];
      const pendingDisplays = new Set();
      const alive = () => !settled && id === generation && now() < deadline;
      const safe = result => {
        if (!result) return result;
        const copy = { ...result, values: { ...result.values }, readings: { ...result.readings } };
        for (const field of ['temperature', 'humidity']) {
          const entry = result.readings?.[field];
          const row = rowContexts === null ? null : validateRowCells(entry?.integerCells || [], entry?.correction?.matrix || IDENTITY, rowContexts);
          if (!result.orientation?.resolvedFields?.[field] || row && !row.valid) {
            copy.values[field] = '';
            if (copy.readings[field]) copy.readings[field] = { ...copy.readings[field], value: '', ...(row && !row.valid ? {
              currentRowValidated: false, rejectionReason: row.reason,
              confidence: { ...copy.readings[field].confidence, numeric: 0 },
              correction: { ...copy.readings[field].correction, orientationResolved: false }
            } : {}) };
          }
        }
        return copy;
      };
      let timer;
      const assemble = entries => {
        const result = mergeResults(entries.filter(Boolean).map(safe), rowContexts);
        if (credibleDisplayIds.length > 1 && pendingDisplays.size) {
          for (const field of ['temperature', 'humidity']) {
            result.values[field] = '';
            if (result.readings[field]) result.readings[field] = { ...result.readings[field], value: '' };
          }
          result.orientation = { ...result.orientation, state: 'pending', resolvedFields: { temperature: false, humidity: false } };
        }
        return result;
      };
      const operation = { finish(result, error) {
        if (settled) return;
        settled = true; worker?.terminate(); environment.clearTimeout(timer);
        stageResolve?.(null); stageResolve = stageReject = null;
        if (current === operation) current = null;
        if (error) reject(error); else resolve(result);
      } };
      current = operation;
      const timeout = () => {
        const result = assemble([...results, partial]);
        result.rejectionReason = 'timeout';
        if (options.region) {
          const identified = ['temperature', 'humidity'].filter(field => result.values[field]);
          result.field = options.field || (identified.length === 1 ? identified[0] : null);
          result.status = result.field ? 'found' : 'unassigned';
        }
        if (Object.values(result.values).some(Boolean)) operation.finish(result);
        else operation.finish(null, Object.assign(new Error('Recognition timed out. Enter values manually.'), { name: 'TimeoutError' }));
      };
      timer = environment.setTimeout(timeout, Math.max(0, deadline - now()));
      const pixels = (region = { x: 0, y: 0, width: 1, height: 1 }) => {
        if (!alive()) return null;
        const width = source.width * region.width, height = source.height * region.height;
        const scale = Math.min(1, 800 / Math.max(width, height));
        const canvas = environment.document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(source, source.width * region.x, source.height * region.y, width, height, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.height = 0;
        return alive() ? { width: image.width, height: image.height, data: image.data } : null;
      };
      const request = async (image, opts, kind = 'analyze', map = value => value) => {
        if (!image || !alive()) { if (!settled) timeout(); return null; }
        const activeStage = ++stageId;
        stageMap = map; partial = null;
        if (!worker) {
          const { checkpoint } = createRecognitionBudget({ now, deadline,
            isCurrent: () => !settled && id === generation,
            yieldControl: () => new Promise(done => environment.setTimeout(done, 0)) });
          const result = await processImage({ pixels: image, options: opts, kind, remainingMs: deadline - now() }, checkpoint,
            value => { if (alive() && activeStage === stageId) partial = safe(map(value)); });
          if (!alive()) { if (!settled) timeout(); return null; }
          return result;
        }
        return new Promise((done, fail) => {
          stageResolve = done; stageReject = fail;
          try { worker.postMessage({ id, stageId: activeStage, pixels: image, options: opts, kind, remainingMs: deadline - now() }); }
          catch (error) { fail(error); }
        });
      };
      const complete = result => Boolean(result?.values?.temperature && result?.values?.humidity && result.orientation?.state === 'resolved');
      void (async () => {
        try {
          if (environment.Worker) worker = new environment.Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
          if (worker) {
            worker.onmessage = event => {
              const data = event.data;
              if (!alive()) { if (!settled) timeout(); return; }
              if (data.id !== id || data.stageId !== stageId) return;
              if (data.progress) { partial = safe(stageMap(data.progress)); return; }
              if (data.error) stageReject?.(Object.assign(new Error(data.error), { name: data.errorName || 'Error' })); else stageResolve?.(data.result);
            };
            worker.onerror = () => operation.finish(null, new Error('Local recognition could not start.'));
          }
          const overview = pixels();
          const prepared = await request(overview, { priorCorrection: options.correction, sourceSize }, 'prepare');
          if (!alive() || !prepared) return;
          if (prepared.rowContexts) rowContexts = mapRowContexts(prepared.rowContexts, [source.width / overview.width, 0, 0, 0, source.height / overview.height, 0, 0, 0, 1]);
          const hypotheses = prepared.hypotheses.slice(0, 4);
          const analyzeCrop = async (crop, opts = {}, displayId = null) => {
            const image = crop ? pixels(crop) : overview;
            if (!image) { if (!settled) timeout(); return null; }
            const region = crop || { x: 0, y: 0, width: 1, height: 1 };
            const inputMap = [region.width * source.width / image.width, 0, region.x * source.width, 0,
              region.height * source.height / image.height, region.y * source.height, 0, 0, 1];
            const map = value => {
              const mapped = mapRegionalResult(value, region, image, sourceSize);
              if (mapped?.rowContexts && rowContexts !== null) {
                rowContexts = dedupeRowContexts([...rowContexts, ...mapped.rowContexts]);
              }
              return mapped && { ...mapped, ...(displayId ? { displayId } : {}),
                orientation: { ...mapped.orientation, credibleDisplayIds } };
            };
            const result = await request(image, { ...opts, ...(rowContexts !== null ? { rowContexts: mapRowContexts(rowContexts, inverse(inputMap)) } : {}), hypotheses: remapHypotheses(hypotheses, image, { crop, sourceSize }), orientation: prepared.orientation }, 'analyze', map);
            return result && safe(map(result));
          };
          if (options.region) {
            const b = options.region;
            const selected = { x: b.x * source.width, y: b.y * source.height, width: b.width * source.width, height: b.height * source.height };
            const containsSelection = box => selected.x + selected.width / 2 >= box.x && selected.x + selected.width / 2 <= box.x + box.width &&
              selected.y + selected.height / 2 >= box.y && selected.y + selected.height / 2 <= box.y + box.height;
            const displays = [];
            for (const proposal of prepared.proposals || []) {
              if (proposal.kind !== 'display' || !(proposal.strokeScore > 0) || !(proposal.axes?.fill > .65) || !(proposal.axes?.aspect > 1.8)) continue;
              const box = { x: proposal.region.x * source.width, y: proposal.region.y * source.height,
                width: proposal.region.width * source.width, height: proposal.region.height * source.height };
              if (containsSelection(box)) displays.push(box);
            }
            if (!displays.length) displays.push(...(rowContexts || []).map(row => projectBox(row.matrix, row.displayBounds)).filter(containsSelection));
            const display = displays[0];
            // Decode the whole LCD for scale/context; assignment remains limited
            // to the user's original selection. An isolated historical crop
            // cannot invent a reference when overview evidence was insufficient.
            const crop = display ? boundedRegion({ x: Math.min(display.x, selected.x), y: Math.min(display.y, selected.y),
              width: Math.max(display.x + display.width, selected.x + selected.width) - Math.min(display.x, selected.x),
              height: Math.max(display.y + display.height, selected.y + selected.height) - Math.min(display.y, selected.y) }, source.width, source.height)
              : { x: 0, y: 0, width: 1, height: 1 };
            const selection = { x: (b.x - crop.x) / crop.width, y: (b.y - crop.y) / crop.height, width: b.width / crop.width, height: b.height / crop.height };
            const result = await analyzeCrop(crop, { ...options, region: selection, refine: true });
            if (alive()) operation.finish(result); return;
          }
          const strong = (prepared.proposals || []).filter(p => p.kind === 'display' && p.strokeScore > 0 &&
            p.axes?.aspect > 1.8 && p.axes?.fill > .65 && p.region.width * p.region.height > .08 &&
            p.region.x > 0 && p.region.y > 0 && p.region.x + p.region.width < 1 && p.region.y + p.region.height < 1);
          const groups = [];
          const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
            Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
          for (const p of strong) {
            const group = groups.find(g => intersection(g.region, p.region) / Math.min(g.region.width * g.region.height, p.region.width * p.region.height) >= .5);
            p.recognitionDisplayId = group?.recognitionDisplayId || p.displayId || `lcd-${groups.length}`;
            if (!group) groups.push(p);
          }
          credibleDisplayIds = groups.map(p => p.recognitionDisplayId);
          for (const id of credibleDisplayIds) pendingDisplays.add(id);
          for (const proposal of strong) {
            const result = await analyzeCrop(proposal.region, { allowPartial: true, refine: true }, proposal.recognitionDisplayId);
            if (!alive()) return;
            results.push(result); pendingDisplays.delete(proposal.recognitionDisplayId);
            const merged = assemble(results);
            if (complete(merged)) { operation.finish(merged); return; }
          }
          const direct = await analyzeCrop(null, { allowPartial: true, quick: true });
          if (!alive()) return;
          results.push(direct);
          if (complete(assemble(results))) { operation.finish(assemble(results)); return; }
          const anchored = humiditySearchRegion(direct, sourceSize);
          const proposals = [...(anchored ? [{ region: anchored, requiredField: 'temperature' }] : []), ...(prepared.proposals || []).filter(p => !strong.includes(p))];
          for (const proposal of proposals) {
            if (!alive()) { if (!settled) timeout(); return; }
            const result = await analyzeCrop(proposal.region, { allowPartial: true, refine: true, ...(proposal.requiredField ? { requiredField: proposal.requiredField } : {}) });
            if (!alive()) return;
            results.push(result);
            const merged = assemble(results);
            if (complete(merged)) { operation.finish(merged); return; }
          }
          if (alive()) operation.finish(assemble(results));
        } catch (error) {
          if (!alive() || error?.name === 'RecognitionDeadlineError') { if (!settled) timeout(); }
          else operation.finish(null, error);
        }
      })();
    });
  }
  return { locate: source => analyze(source), readRegion: (source, region, field, correction) => analyze(source, { region, field, correction }), cancel };
}
