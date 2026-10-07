// A scoped synchronous guard lets pure pixel loops honour the same operation
// deadline as the asynchronous worker/fallback orchestration.
let activeCheck = null;

export const RECOGNITION_LIMIT_MS = 10000;

export class RecognitionDeadlineError extends Error {
  constructor() { super('Recognition deadline reached.'); this.name = 'RecognitionDeadlineError'; }
}
export class RecognitionCancelledError extends Error {
  constructor() { super('Recognition cancelled.'); this.name = 'RecognitionCancelledError'; }
}

export function createRecognitionBudget({ now = () => performance.now(), deadline,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)), isCurrent = () => true }) {
  const check = () => {
    if (!isCurrent()) throw new RecognitionCancelledError();
    if (now() >= deadline) throw new RecognitionDeadlineError();
    return true;
  };
  const checkpoint = async () => { check(); await yieldControl(); return check(); };
  checkpoint.check = check;
  return { check, checkpoint };
}

export function runWithRecognitionBudget(check, work) {
  const previous = activeCheck;
  activeCheck = typeof check === 'function' ? check : previous;
  try { checkRecognitionBudget(); return work(); }
  finally { activeCheck = previous; }
}

export function checkRecognitionBudget() { return activeCheck?.() ?? true; }
