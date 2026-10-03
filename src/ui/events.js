

export function createEvents({
  state,
  elements,
  uiPreferences,
  dialogScrollLock,
  startVoiceInput,
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
  openPlanDialog,
  closePlanDialog,
} = {}, environment = globalThis) {
  const { window, document, requestAnimationFrame, ResizeObserver } = environment;

  function bindEvents() {
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
    const indoorOpeners = [editIndoor, summaryEdit, summaryVoice];
    let indoorDialogOpener = null;
    [indoorDialog, elements.planDialog, elements.locationDialog, elements.settingsDialog, elements.timerDialog].filter(Boolean).forEach(dialog => {
      dialog.addEventListener('close', dialogScrollLock.release);
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
        if (startedOutside && isOutside(event)) dialog.close();
        startedOutside = false;
      });
      dialog.addEventListener('close', () => { startedOutside = false; });
    });
    const openIndoorEditor = opener => {
      indoorDialogOpener = opener;
      opener?.setAttribute('aria-expanded', 'true');
      dialogScrollLock.open(indoorDialog);
      document.querySelector('#indoor-heading').focus({ preventScroll: true });
    };
    editIndoor.addEventListener('click', () => openIndoorEditor(editIndoor));
    summaryEdit.addEventListener('click', () => openIndoorEditor(summaryEdit));
    document.querySelector('#indoorDoneButton').addEventListener('click', () => indoorDialog.close());
    indoorDialog.addEventListener('close', () => {
      if (!elements.voiceDialog.hidden) closeVoiceDialog();
      indoorOpeners.forEach(opener => opener.setAttribute('aria-expanded', 'false'));
      (indoorDialogOpener || elements.locationButton).focus({ preventScroll: true });
      indoorDialogOpener = null;
    });
    elements.settingsButton.addEventListener('click', () => {
      elements.settingsButton.setAttribute('aria-expanded', 'true');
      dialogScrollLock.open(elements.settingsDialog);
      elements.settingsDialogTitle.focus({ preventScroll: true });
    });
    elements.settingsDialog.addEventListener('close', () => {
      elements.settingsButton.setAttribute('aria-expanded', 'false');
      elements.settingsButton.focus({ preventScroll: true });
    });
    elements.showIndoorSummary.addEventListener('change', () => {
      uiPreferences.showIndoorSummary = elements.showIndoorSummary.checked;
      applyUiPreferences();
      saveUiPreferences();
    });
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
    bindTypedValue(elements.indoorTempInput, "indoorTemp", 10, 32, saveIndoorReadings);
    bindTypedValue(elements.indoorRhInput, "indoorRh", 20, 90, saveIndoorReadings);
    bindSteppers();
    bindReadingRulers();
    bindTypedValue(elements.targetRhInput, "targetRh", 40, 65, savePlanSettings);
    bindTypedValue(elements.minTempInput, "minTemp", 16, 26, savePlanSettings);

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
    elements.locationButton.addEventListener("click", openLocationDialog);
    elements.locationDialog.addEventListener("close", () => {
      cancelLocationWork();
      elements.locationButton.focus({ preventScroll: true });
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
        else dialog.close();
      });
    });
    elements.planSummaryButton.addEventListener("click", openPlanDialog);
    elements.planDoneButton.addEventListener("click", closePlanDialog);
    elements.planDialog.addEventListener("close", () => {
      elements.planSummaryButton.focus({ preventScroll: true });
    });
    if (voiceSupported) {
      elements.voiceInputButton.hidden = false;
      summaryVoice.hidden = false;
      summaryVoice.addEventListener('click', () => {
        indoorDialogOpener = summaryVoice;
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
    document.documentElement.dataset.showIndoorSummary = String(uiPreferences.showIndoorSummary);
    elements.showIndoorSummary.checked = uiPreferences.showIndoorSummary;
    elements.openIndoorOnLaunch.checked = uiPreferences.openIndoorOnLaunch;
  }

  return { bindEvents, applyUiPreferences };
}
