// Selection belongs to the session, not to the transient track being opened.
export function createZoomPresets({ buttons, onValue }) {
  let selected = 1, disabled = true;
  function render() {
    for (const [value, button] of buttons) {
      button.setAttribute('aria-pressed', String(value === selected));
      button.disabled = disabled;
    }
  }
  return {
    initialize(listen = (target, ...args) => target.addEventListener(...args)) {
      for (const [value, button] of buttons) listen(button, 'click', () => {
        if (disabled) return;
        selected = value; render(); onValue(value);
      });
      render();
    },
    sync({ available, capturing }) { disabled = !available || capturing; render(); },
    reset() { selected = 1; disabled = true; render(); },
  };
}
