export const TIMER_SHORTCUT_NAME = 'Ventilation Timer';
export const TIMER_SHORTCUT_INSTALL_URL = 'https://www.icloud.com/shortcuts/d16fde94799a414bb11a3a40c484f080';

export function isAppleMobile(navigator = globalThis.navigator) {
  return /iPhone|iPad|iPod/.test(navigator?.userAgent || '') ||
    (navigator?.platform === 'MacIntel' && navigator?.maxTouchPoints > 1);
}

export function validTimerMinutes(value) {
  return Number.isInteger(value) && value >= 1 && value <= 180;
}

export function timerShortcutUrl(minutes) {
  if (!validTimerMinutes(minutes)) throw new RangeError('Timer must be 1-180 whole minutes');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(TIMER_SHORTCUT_NAME)}&input=text&text=${minutes}`;
}

export function createTimerController({ state, elements, dialogScrollLock, renderRulers, rememberSheetFocus, restoreSheetFocus, closeSheet } = {}, environment = globalThis) {
  const { window } = environment;
  let opener = null;
  const finishClose = () => {
    if (elements.timerDialog.open || !opener) return;
    if (elements.timerHelp) elements.timerHelp.open = false;
    opener.setAttribute('aria-expanded', 'false');
    restoreSheetFocus(elements.timerDialog);
    opener = null;
  };
  const sync = () => {
    const minutes = elements.timerMinutesInput.valueAsNumber;
    const valid = validTimerMinutes(minutes);
    elements.timerStartButton.disabled = !valid;
    elements.timerMinutesInput.setAttribute('aria-invalid', String(!valid));
    if (valid) {
      state.timerMinutes = minutes;
      elements.timerMinutes.value = minutes;
      renderRulers();
    }
  };
  function initialize() {
    elements.recommendation.addEventListener('click', event => {
      const button = event.target.closest('[data-timer-minutes]');
      if (!button || !elements.recommendation.contains(button)) return;
      const minutes = Number(button.dataset.timerMinutes);
      if (!validTimerMinutes(minutes)) return;
      opener = button;
      rememberSheetFocus(elements.timerDialog, button, elements.decisionLabel);
      button.setAttribute('aria-expanded', 'true');
      state.timerMinutes = minutes;
      elements.timerMinutesInput.value = minutes;
      elements.timerMinutes.value = minutes;
      dialogScrollLock.open(elements.timerDialog);
      sync();
      elements.timerDialogTitle.focus({ preventScroll: true });
    });
    elements.timerMinutesInput.addEventListener('input', sync);
    elements.timerMinutesInput.addEventListener('focus', () => elements.timerMinutesInput.select());
    elements.timerMinutesInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); elements.timerMinutesInput.blur(); }
    });
    elements.timerMinutes.addEventListener('input', () => {
      elements.timerMinutesInput.value = elements.timerMinutes.value;
      sync();
    });
    elements.timerStartButton.addEventListener('click', () => {
      const minutes = elements.timerMinutesInput.valueAsNumber;
      if (!elements.timerDialog.open || !validTimerMinutes(minutes)) return;
      closeSheet(elements.timerDialog);
      // Native close events are queued; finish before handing control to another app.
      dialogScrollLock.release();
      finishClose();
      // The browser cannot confirm whether Shortcuts actually starts the Clock timer.
      window.location.href = timerShortcutUrl(minutes);
    });
    elements.timerDialog.addEventListener('close', finishClose);
    elements.timerDialog.addEventListener('click', event => {
      if (elements.timerHelp?.open && !elements.timerHelp.contains(event.target)) elements.timerHelp.open = false;
    });
    elements.timerDialog.addEventListener('cancel', event => {
      if (!elements.timerHelp?.open) return;
      event.preventDefault();
      elements.timerHelp.open = false;
      elements.timerHelp.querySelector('summary').focus({ preventScroll: true });
    });
    if (TIMER_SHORTCUT_INSTALL_URL) {
      elements.timerInstallLink.href = TIMER_SHORTCUT_INSTALL_URL;
    }
  }
  return { initialize };
}
