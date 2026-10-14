export function normalizeThemePreference(value) {
  return ['system', 'light', 'dark'].includes(value) ? value : 'system';
}

export function resolveTheme(preference, systemDark) {
  const selected = normalizeThemePreference(preference);
  return selected === 'system' ? (systemDark ? 'dark' : 'light') : selected;
}

export function createThemeController({ preferences, root, controls, save } = {}, environment = globalThis) {
  const { document, window } = environment;
  const target = root || document.documentElement;
  const options = [...(controls || document.querySelectorAll('[data-theme-preference]'))];
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  let bound = false;

  function apply() {
    preferences.theme = normalizeThemePreference(preferences.theme);
    const resolved = resolveTheme(preferences.theme, system?.matches === true);
    target.dataset.theme = resolved;
    target.style.setProperty('color-scheme', resolved);
    for (const control of options) control.checked = control.value === preferences.theme;
  }

  function bind() {
    if (bound) return;
    bound = true;
    for (const control of options) control.addEventListener('change', () => {
      if (!control.checked) return;
      preferences.theme = normalizeThemePreference(control.value);
      apply();
      save?.();
    });
    const systemChanged = () => { if (preferences.theme === 'system') apply(); };
    if (system?.addEventListener) system.addEventListener('change', systemChanged);
    else system?.addListener?.(systemChanged);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') apply();
    });
    window.addEventListener('pageshow', apply);
  }

  return { apply, bind };
}
