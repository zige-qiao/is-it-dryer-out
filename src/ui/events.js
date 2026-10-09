import { INDOOR_LIMITS } from '../config.js';


export function createEvents({
  state,
  elements,
  uiPreferences,
  dialogScrollLock,
  startVoiceInput,
  startCameraInput,
  applyPageLayout,
  toggleVoiceListening,
  closeVoiceDialog,
  applyVoiceChanges,
  voiceSupported,
  saveIndoorReadings,
  savePlanSettings,
  saveUiPreferences,
  fetchWeather,
  handleLocationInput,
  handleLocationSearch,
  useCurrentLocation,
  openLocationDialog,
  closeLocationDialog,
  cancelLocationWork,
  render,
  renderAhChart,
  bindTypedValue,
  bindSteppers,
  bindReadingRulers,
  enableSheetDrag,
  bindSheetFocus,
  rememberSheetFocus,
  restoreSheetFocus,
  closeSheet,
  openPlanDialog,
  closePlanDialog,
} = {}, environment = globalThis) {
  const { window, document, requestAnimationFrame, ResizeObserver } = environment;

  function bindChartKey() {
    const key = document.querySelector('#chartKey');
    key?.addEventListener('toggle', () => {
      if (uiPreferences.showChartKey === key.open) return;
      uiPreferences.showChartKey = key.open;
      saveUiPreferences();
    });
  }

  function bindEvents() {
    bindChartKey();
    bindSheetFocus();
    let lastChartWidth = 0;
    const chartResizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - lastChartWidth) < .5) return;
      lastChartWidth = width;
      renderAhChart();
    });
    chartResizeObserver.observe(document.querySelector('#ahChart'));
    const indoorDialog = document.querySelector('#indoorDialog');
    const editIndoor = document.querySelector('#editIndoorButton');
    const summaryEdit = document.querySelector('#indoorSummaryEdit');
    const summaryVoice = document.querySelector('#indoorSummaryVoice');
    const summaryCamera = document.querySelector('#indoorSummaryCamera');
    const settingsEdit = document.querySelector('#settingsEditIndoor');
    const indoorOpeners = [editIndoor, summaryEdit, summaryVoice, summaryCamera];
    [indoorDialog, elements.planDialog, elements.locationDialog, elements.settingsDialog, elements.timerDialog].filter(Boolean).forEach(dialog => {
      dialog.addEventListener('close', dialogScrollLock.release);
      dialog.addEventListener('cancel', event => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        closeSheet(dialog);
      });
      enableSheetDrag(dialog);
      let startedOutside = false;
      const isOutside = event => {
        const bounds = dialog.getBoundingClientRect();
        return event.target === dialog && (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        );
      };
      dialog.addEventListener('pointerdown', event => {
        startedOutside = isOutside(event);
      });
      dialog.addEventListener('pointercancel', () => { startedOutside = false; });
      dialog.addEventListener('click', event => {
        if (startedOutside && isOutside(event)) closeSheet(dialog);
        startedOutside = false;
      });
      dialog.addEventListener('close', () => { startedOutside = false; });
    });
    const openIndoorEditor = opener => {
      const fallback = uiPreferences.showRecommendation === false ? elements.settingsButton : elements.locationButton;
      rememberSheetFocus(indoorDialog, opener, fallback);
      if (opener?.getAttribute('aria-controls') === 'indoorDialog') opener.setAttribute('aria-expanded', 'true');
      dialogScrollLock.open(indoorDialog);
      document.querySelector('#indoor-heading').focus({ preventScroll: true });
    };
    editIndoor.addEventListener('click', () => openIndoorEditor(editIndoor));
    summaryEdit.addEventListener('click', () => openIndoorEditor(summaryEdit));
    summaryCamera.addEventListener('click', () => { openIndoorEditor(summaryCamera); void startCameraInput(); });
    settingsEdit.addEventListener('click', () => {
      closeSheet(elements.settingsDialog);
      openIndoorEditor(elements.settingsButton);
    });
    document.querySelector('#indoorDoneButton').addEventListener('click', () => closeSheet(indoorDialog));
    indoorDialog.addEventListener('close', () => {
      if (!elements.voiceDialog.hidden) closeVoiceDialog();
      indoorOpeners.forEach(opener => opener.setAttribute('aria-expanded', 'false'));
      restoreSheetFocus(indoorDialog);
    });
    elements.settingsButton.addEventListener('click', () => {
      rememberSheetFocus(elements.settingsDialog, elements.settingsButton, elements.settingsButton);
      elements.settingsButton.setAttribute('aria-expanded', 'true');
      dialogScrollLock.open(elements.settingsDialog);
      elements.settingsDialogTitle.focus({ preventScroll: true });
    });
    elements.settingsDialog.addEventListener('close', () => {
      elements.settingsButton.setAttribute('aria-expanded', 'false');
      restoreSheetFocus(elements.settingsDialog);
    });

    elements.autoFlash?.addEventListener('change', () => { uiPreferences.autoFlash = elements.autoFlash.checked; saveUiPreferences(); });
    for (const key of ['useStillPhotos', 'showCameraButton', 'showVoiceButton']) {
      elements[key]?.addEventListener('change', () => {
        uiPreferences[key] = elements[key].checked;
        applyUiPreferences(); saveUiPreferences();
      });
    }
    elements.openIndoorOnLaunch.addEventListener('change', () => {
      uiPreferences.openIndoorOnLaunch = elements.openIndoorOnLaunch.checked;
      saveUiPreferences();
    });
    if (uiPreferences.openIndoorOnLaunch) {
      requestAnimationFrame(() => {
        if (!document.querySelector('dialog[open]')) openIndoorEditor(null);
      });
    }
    document.querySelectorAll('[data-chart-hours]').forEach(button => button.addEventListener('click', () => {
      state.chartHours = Number(button.dataset.chartHours);
      state.chartSelection = Math.min(state.chartSelection, state.chartHours);
      renderAhChart();
    }));
    elements.indoorTemp.addEventListener("input", (event) => {
      state.indoorTemp = Number(event.target.value);
      saveIndoorReadings();
      render();
    });
    elements.indoorRh.addEventListener("input", (event) => {
      state.indoorRh = Number(event.target.value);
      saveIndoorReadings();
      render();
    });
    bindTypedValue(elements.indoorTempInput, "indoorTemp", INDOOR_LIMITS.temperature.min, INDOOR_LIMITS.temperature.max, saveIndoorReadings);
    bindTypedValue(elements.indoorRhInput, "indoorRh", INDOOR_LIMITS.humidity.min, INDOOR_LIMITS.humidity.max, saveIndoorReadings);
    bindSteppers();
    bindReadingRulers();
    bindTypedValue(elements.targetRhInput, "targetRh", 35, 65, savePlanSettings);
    bindTypedValue(elements.minTempInput, "minTemp", 8, 28, savePlanSettings);

    elements.targetRh.addEventListener("input", (event) => {
      state.targetRh = Number(event.target.value);
      savePlanSettings();
      render();
    });
    elements.minTemp.addEventListener("input", (event) => {
      state.minTemp = Number(event.target.value);
      savePlanSettings();
      render();
    });

    elements.roomPreset.addEventListener("change", (event) => {
      state.roomPreset = event.target.value;
      savePlanSettings();
      render();
    });
    bindTypedValue(elements.roomLength, "roomLength", 1, 20, savePlanSettings);
    bindTypedValue(elements.roomWidth, "roomWidth", 1, 20, savePlanSettings);
    bindTypedValue(elements.roomHeight, "roomHeight", 1.8, 5, savePlanSettings);

    elements.openingSetup.addEventListener("change", (event) => {
      state.openingSetup = event.target.value;
      savePlanSettings();
      render();
    });
    bindTypedValue(elements.customAirflow, "customAirflow", 10, 500, savePlanSettings);

    elements.refreshWeather.addEventListener("click", fetchWeather);
    document.querySelector("#pageRefreshButton").addEventListener("click", () => window.location.reload());
    elements.locationButton.addEventListener("click", () => {
      rememberSheetFocus(elements.locationDialog, elements.locationButton, elements.locationButton);
      openLocationDialog();
    });
    elements.locationDialog.addEventListener("close", () => {
      cancelLocationWork();
      restoreSheetFocus(elements.locationDialog);
    });
    elements.locationUpdateButton.addEventListener("click", useCurrentLocation);
    elements.locationSearchForm.addEventListener("submit", handleLocationSearch);
    elements.locationSearchInput.addEventListener("input", handleLocationInput);
    elements.locationClearButton.addEventListener("click", () => {
      elements.locationSearchInput.value = "";
      handleLocationInput();
      elements.locationSearchInput.focus();
    });
    document.querySelectorAll("[data-close-dialog]").forEach(button => {
      button.addEventListener("click", () => {
        const dialog = button.closest("dialog");
        if (dialog === elements.locationDialog) closeLocationDialog();
        else closeSheet(dialog);
      });
    });
    elements.planSummaryButton.addEventListener("click", () => {
      rememberSheetFocus(elements.planDialog, elements.planSummaryButton, elements.planSummaryButton);
      openPlanDialog();
    });
    elements.planDoneButton.addEventListener("click", closePlanDialog);
    elements.planDialog.addEventListener("close", () => {
      restoreSheetFocus(elements.planDialog);
    });
    if (voiceSupported) {
      elements.voiceInputButton.hidden = uiPreferences.showVoiceButton === false;
      summaryVoice.hidden = uiPreferences.showVoiceButton === false;
      summaryVoice.addEventListener('click', () => {
        rememberSheetFocus(indoorDialog, summaryVoice, elements.locationButton);
        summaryVoice.setAttribute('aria-expanded', 'true');
        startVoiceInput();
      });
      elements.voiceInputButton.addEventListener("click", toggleVoiceListening);
      elements.voiceListenButton.addEventListener("click", toggleVoiceListening);
      elements.voiceDialogCloseButton.addEventListener("click", closeVoiceDialog);
      elements.voiceApplyButton.addEventListener("click", applyVoiceChanges);

    }
  }

  function applyUiPreferences() {
    const chartKey = document.querySelector('#chartKey');
    if (chartKey && chartKey.open !== (uiPreferences.showChartKey === true)) chartKey.open = uiPreferences.showChartKey === true;
    applyPageLayout?.();
    elements.showIndoorSummary.checked = uiPreferences.showIndoorSummary;
    if (elements.autoFlash) elements.autoFlash.checked = uiPreferences.autoFlash;
    for (const key of ['useStillPhotos', 'showCameraButton', 'showVoiceButton']) {
      if (elements[key]) elements[key].checked = key === 'useStillPhotos' ? uiPreferences[key] === true : uiPreferences[key] !== false;
    }
    const cameraHidden = uiPreferences.showCameraButton === false;
    if (elements.settingsCameraOptions) {
      if (cameraHidden && elements.settingsCameraOptions.contains(document.activeElement)) {
        elements.showCameraButton.focus({ preventScroll: true });
      }
      elements.settingsCameraOptions.hidden = cameraHidden;
    }
    if (elements.cameraInputButton) elements.cameraInputButton.hidden = cameraHidden;
    const summaryCamera = document.querySelector('#indoorSummaryCamera');
    if (summaryCamera) summaryCamera.hidden = cameraHidden;
    if (elements.voiceInputButton) elements.voiceInputButton.hidden = !voiceSupported || uiPreferences.showVoiceButton === false;
    const summaryVoice = document.querySelector('#indoorSummaryVoice');
    if (summaryVoice) summaryVoice.hidden = !voiceSupported || uiPreferences.showVoiceButton === false;
    elements.openIndoorOnLaunch.checked = uiPreferences.openIndoorOnLaunch;
  }

  return { bindEvents, applyUiPreferences, bindChartKey };
}
