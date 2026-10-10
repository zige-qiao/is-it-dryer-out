import { createVoiceController } from './src/voice/controller.js';
import { createCameraLoader, loadCameraModule } from './src/ui/camera-loader.js';
import { createStorage } from './src/services/storage.js';
import { createGeocoding } from './src/services/geocoding.js';
import { createWeatherController } from './src/services/weather.js';
import { createLocationController } from './src/ui/location.js';
import { createFormatters } from './src/ui/format.js';
import { createRecommendationView } from './src/ui/recommendation.js';
import { createDashboard } from './src/ui/dashboard.js';
import { createChart } from './src/ui/chart.js';
import { createReadingControls } from './src/ui/readings.js';
import { createDialogs } from './src/ui/dialogs.js';
import { createSheetChrome } from './src/ui/sheet-chrome.js';
import { createPullRefresh } from './src/ui/pull-refresh.js';
import { createPageLayout, pageLayoutDefaults } from './src/ui/page-layout.js';
import { createPageNavigation } from './src/ui/page-navigation.js';
import { createEvents } from './src/ui/events.js';
import { createTimerController, isAppleMobile } from './src/ui/timer.js';
import { DEFAULT_LOCATION, DEFAULT_PRESSURE_HPA, DEFAULT_TIMEZONE, WEATHER_REFRESH_INTERVAL_MS } from './src/config.js';

const uiPreferences = { showChartKey: false, ...pageLayoutDefaults(), openIndoorOnLaunch: true, autoFlash: true,
  useStillPhotos: false, showCameraButton: true, showVoiceButton: false };

const state = {
  indoorReadingSource: null,
  indoorLastSet: null,
  timerMinutes: 1,
  indoorTemp: 24,
  indoorRh: 58,
  targetRh: 55,
  minTemp: 18,
  roomPreset: "medium",
  roomLength: 4,
  roomWidth: 5,
  roomHeight: 2.5,
  openingSetup: "single",
  customAirflow: 80,
  outdoorTemp: null,
  outdoorRh: null,
  outdoorDewPoint: null,
  outdoorPressure: DEFAULT_PRESSURE_HPA,
  outdoorWind: 0,
  outdoorWindAvailable: false,
  outdoorWindDirection: null,
  forecast: [],
  chartHours: 48,
  chartSelection: 0,
  updatedAt: null,
  lastCheckedAt: null,
  lastSuccessfulUpdateAt: null,
  weatherRequestPending: false,
  weatherLoadFailed: false,
  timezone: DEFAULT_TIMEZONE,
  location: { ...DEFAULT_LOCATION },
  locationMode: "current",
};

const elements = {
  cameraLoadError: document.querySelector('#cameraLoadError'),
  indoorDialog: document.querySelector('#indoorDialog'),
  cameraTitle: document.querySelector('#indoor-heading'),
  ...Object.fromEntries(['cameraInputButton', 'cameraBackButton', 'cameraPanel', 'cameraCapturePanel',
    'cameraReviewPanel', 'cameraErrorPanel', 'cameraVideo', 'cameraPreview', 'cameraFlash', 'cameraCaptureStatus',
    'cameraCaptureButton', 'cameraPhoto', 'cameraTempBox', 'cameraRhBox', 'cameraReadStatus',
    'cameraTempCrop', 'cameraRhCrop', 'cameraTempDraft', 'cameraRhDraft', 'cameraTempError',
    'cameraRhError', 'cameraRetakeButton', 'cameraPendingBox', 'cameraAssignment', 'cameraAssignChoices', 'cameraAssignTemp', 'cameraAssignRh', 'cameraDiscardBox',
    'cameraConfirmButton', 'cameraPhotoWrap', 'cameraErrorMessage', 'cameraErrorHelp', 'cameraErrorDetails',
    'cameraManualButton', 'cameraRetryButton', 'cameraFeed', 'cameraZoomControl', 'cameraZoom1', 'cameraZoom3', 'cameraZoom5',
    'cameraAutoFlashSettings', 'cameraHelpButton', 'cameraCropHint', 'cameraCaptureHint', 'cameraReviewHint', 'cameraReadStatusText'].map(id => [id, document.querySelector('#' + id)])),
  timerDialog: document.querySelector('#timerDialog'),
  timerDialogTitle: document.querySelector('#timerDialogTitle'),
  timerMinutes: document.querySelector('#timerMinutes'),
  timerMinutesInput: document.querySelector('#timerMinutesInput'),
  timerStartButton: document.querySelector('#timerStartButton'),
  timerInstallLink: document.querySelector('#timerInstallLink'),
  timerHelp: document.querySelector('#timerHelp'),
  recommendation: document.querySelector(".recommendation"),
  verdictPanel: document.querySelector(".verdict-panel"),
  forecastPanel: document.querySelector(".forecast-panel"),
  dashboardPanel: document.querySelector(".dashboard-panel"),
  decisionLabel: document.querySelector("#decisionLabel"),
  decisionPrimary: document.querySelector("#decisionPrimary"),
  decisionSecondary: document.querySelector("#decisionSecondary"),
  weatherStatus: document.querySelector("#weatherStatus"),
  indoorTemp: document.querySelector("#indoorTemp"),
  indoorRh: document.querySelector("#indoorRh"),
  indoorTempInput: document.querySelector("#indoorTempInput"),
  indoorRhInput: document.querySelector("#indoorRhInput"),
  indoorTempValue: document.querySelector("#indoorTempValue"),
  indoorRhValue: document.querySelector("#indoorRhValue"),
  indoorSummaryTemp: document.querySelector("#indoorSummaryTemp"),
  indoorSummaryRh: document.querySelector("#indoorSummaryRh"),
  settingsButton: document.querySelector("#settingsButton"),
  autoFlash: document.querySelector("#autoFlash"),
  useStillPhotos: document.querySelector("#useStillPhotos"),
  showCameraButton: document.querySelector("#showCameraButton"),
  settingsCameraOptions: document.querySelector("#settingsCameraOptions"),
  showVoiceButton: document.querySelector("#showVoiceButton"),
  cameraSwitchPreview: document.querySelector("#cameraSwitchPreview"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsDialogTitle: document.querySelector("#settingsDialogTitle"),
  showIndoorSummary: document.querySelector("#showIndoorSummary"),
  openIndoorOnLaunch: document.querySelector("#openIndoorOnLaunch"),
  pullRefresh: document.querySelector("#pullRefresh"),
  pullRefreshText: document.querySelector("#pullRefreshText"),
  outdoorTempValue: document.querySelector("#outdoorTempValue"),
  outdoorRhValue: document.querySelector("#outdoorRhValue"),
  indoorDewPoint: document.querySelector("#indoorDewPoint"),
  outdoorDewPoint: document.querySelector("#outdoorDewPoint"),
  indoorAbsoluteHumidity: document.querySelector("#indoorAbsoluteHumidity"),
  outdoorAbsoluteHumidity: document.querySelector("#outdoorAbsoluteHumidity"),
  warmingTemp: document.querySelector("#warmingTemp"),
  warmedOutdoorRh: document.querySelector("#warmedOutdoorRh"),
  adjustedAirNote: document.querySelector("#adjustedAirNote"),
  explanationText: document.querySelector("#explanationText"),
  ...Object.fromEntries(['explanationStatus', 'explanationOverview', 'explanationDetails',
    'explanationDetailsSummary', 'explanationToggle'].map(id => [id, document.querySelector('#' + id)])),
  explanationHorizon: document.querySelector("#explanationHorizon"),
  explanationRain: document.querySelector("#explanationRain"),
  explanationWind: document.querySelector("#explanationWind"),
  explanationModel: document.querySelector("#explanationModel"),
  weatherDataStatus: document.querySelector("#weatherDataStatus"),
  weatherDataUpdated: document.querySelector("#weatherDataUpdated"),
  refreshWeather: document.querySelector("#refreshWeather"),
  targetRh: document.querySelector("#targetRh"),
  minTemp: document.querySelector("#minTemp"),
  targetRhInput: document.querySelector("#targetRhInput"),
  minTempInput: document.querySelector("#minTempInput"),
  roomPreset: document.querySelector("#roomPreset"),
  customRoomFields: document.querySelector("#customRoomFields"),
  roomLength: document.querySelector("#roomLength"),
  roomWidth: document.querySelector("#roomWidth"),
  roomHeight: document.querySelector("#roomHeight"),
  roomVolume: document.querySelector("#roomVolume"),
  openingSetup: document.querySelector("#openingSetup"),
  customFlowField: document.querySelector("#customFlowField"),
  customAirflow: document.querySelector("#customAirflow"),
  planConfidence: document.querySelector("#planConfidence"),
  planSummaryButton: document.querySelector("#planSummaryButton"),
  planSummaryText: document.querySelector("#planSummaryText"),
  planSummaryVentilationText: document.querySelector("#planSummaryVentilationText"),
  planDialog: document.querySelector("#planDialog"),
  planDoneButton: document.querySelector("#planDoneButton"),
  planDialogTitle: document.querySelector("#planDialogTitle"),
  locationName: document.querySelector("#locationName"),
  sourceLocationName: document.querySelector("#sourceLocationName"),
  liveWeatherRequest: document.querySelector("#liveWeatherRequest"),
  locationButton: document.querySelector("#locationButton"),
  locationDialog: document.querySelector("#locationDialog"),
  locationDialogStatus: document.querySelector("#locationDialogStatus"),
  locationUpdateButton: document.querySelector("#locationUpdateButton"),
  locationSearchForm: document.querySelector("#locationSearchForm"),
  locationSearchInput: document.querySelector("#locationSearchInput"),
  locationClearButton: document.querySelector("#locationClearButton"),
  locationCurrentName: document.querySelector("#locationCurrentName"),
  locationIdle: document.querySelector("#locationIdle"),
  locationRecents: document.querySelector("#locationRecents"),
  locationRecentList: document.querySelector("#locationRecentList"),
  locationSearchResults: document.querySelector("#locationSearchResults"),
  voiceInputButton: document.querySelector("#voiceInputButton"),
  voiceDialog: document.querySelector("#voiceDialog"),
  voiceStatus: document.querySelector("#voiceStatus"),
  voiceExamples: document.querySelector("#voiceExamples"),
  voiceTranscriptPanel: document.querySelector("#voiceTranscriptPanel"),
  voiceTranscript: document.querySelector("#voiceTranscript"),
  voiceChanges: document.querySelector("#voiceChanges"),
  voiceUpdateNote: document.querySelector("#voiceUpdateNote"),
  voiceDialogCloseButton: document.querySelector("#voiceDialogCloseButton"),
  voiceListenButton: document.querySelector("#voiceListenButton"),
  voiceApplyButton: document.querySelector("#voiceApplyButton"),
};

// Callbacks connect features without circular module imports.
const dialogScrollLock = {
  open: (...args) => lock.open(...args),
  release: (...args) => lock.release(...args),
};
// Rulers, sliders and held steppers can emit several inputs per frame; draw once.
let renderFrame = null;
const scheduleRender = () => {
  renderFrame ??= requestAnimationFrame(() => { renderFrame = null; dashboard.render(); });
};
const voiceController = createVoiceController({
  state,
  elements,
  dialogScrollLock,
  saveIndoorReadings: (...args) => storage.saveIndoorReadings(...args),
  formatTemp: (...args) => formatters.formatTemp(...args),
  formatRh: (...args) => formatters.formatRh(...args),
  render: (...args) => dashboard.render(...args),
});
const storage = createStorage({
  state,
  uiPreferences,
  applyUiPreferences: (...args) => events.applyUiPreferences(...args),
});
// Camera recognition is most of the module graph, so it loads on first use.
let cameraController = null;
const cameraLoader = createCameraLoader({
  canActivate: () => elements.indoorDialog.open && document.visibilityState === 'visible',
  setBusy: busy => {
    for (const button of [elements.cameraInputButton, document.querySelector('#indoorSummaryCamera')]) {
      button.disabled = busy;
      button.classList.toggle('is-loading', busy);
      button.setAttribute('aria-busy', String(busy));
    }
  },
  showError: message => {
    elements.cameraLoadError.hidden = !message;
    elements.cameraLoadError.textContent = message;
  },
  load: async () => {
    const { createCameraController } = await loadCameraModule();
    const camera = createCameraController({
      state, elements, uiPreferences,
      openFlashSettings: () => {
        elements.settingsButton.click();
        dialogs.rememberSheetFocus(elements.settingsDialog, elements.cameraHelpButton, elements.cameraHelpButton);
        const setting = uiPreferences.showCameraButton === false ? elements.showCameraButton : elements.autoFlash;
        setting.focus({ preventScroll: true });
        setting.closest('.settings-toggle').scrollIntoView({ block: 'nearest', behavior: 'instant' });
      },
      beforeCamera: () => {
        dialogs.rememberSheetFocus(elements.cameraPanel, elements.cameraInputButton, elements.cameraTitle);
        if (!elements.voiceDialog.hidden) voiceController.closeVoiceDialog();
      },
      saveIndoorReadings: (...args) => storage.saveIndoorReadings(...args),
      render: () => dashboard.render(),
      returnFocus: () => {
        dialogs.restoreSheetFocus(elements.cameraPanel);
      },
    });
    return {
      initialize: () => { camera.initialize(); cameraController = camera; },
      startCamera: () => camera.startCamera(),
    };
  },
});
elements.cameraInputButton.addEventListener('click', () => void cameraLoader.start());
elements.indoorDialog.addEventListener('close', () => cameraLoader.cancel());
const geocoding = createGeocoding({

});
const weatherController = createWeatherController({
  state,
  elements,
  saveLocation: (...args) => storage.saveLocation(...args),
  updateLocationUi: (...args) => locationController.updateLocationUi(...args),
  formatShortTime: (...args) => formatters.formatShortTime(...args),
  render: (...args) => dashboard.render(...args),
});
const locationController = createLocationController({
  closeSheet: (...args) => dialogs.closeSheet(...args),
  state,
  elements,
  dialogScrollLock,
  hasRequestedLocation: (...args) => storage.hasRequestedLocation(...args),
  markLocationRequested: (...args) => storage.markLocationRequested(...args),
  reverseGeocodeLocation: (...args) => geocoding.reverseGeocodeLocation(...args),
  formatSearchLocation: (...args) => geocoding.formatSearchLocation(...args),
  searchLocations: (...args) => geocoding.searchLocations(...args),
  isUkPostcodeQuery: (...args) => geocoding.isUkPostcodeQuery(...args),
  getBrowserLocation: (...args) => geocoding.getBrowserLocation(...args),
  weatherUrlForLocation: (...args) => weatherController.weatherUrlForLocation(...args),
  fetchWeather: (...args) => weatherController.fetchWeather(...args),
  setLocation: (...args) => weatherController.setLocation(...args),
  readLocationHistory: (...args) => storage.loadLocationHistory(...args),
  writeLocationHistory: (...args) => storage.saveLocationHistory(...args),
});
const formatters = createFormatters({
  state,
});
const recommendationView = createRecommendationView({
  timerSupported: isAppleMobile(),
  state,
  elements,
  formatTemp: (...args) => formatters.formatTemp(...args),
  formatRh: (...args) => formatters.formatRh(...args),
  formatDuration: (...args) => formatters.formatDuration(...args),
});
const dashboard = createDashboard({
  state,
  elements,
  weatherUrlForLocation: (...args) => weatherController.weatherUrlForLocation(...args),
  formatTemp: (...args) => formatters.formatTemp(...args),
  formatRh: (...args) => formatters.formatRh(...args),
  formatWeatherTimestamp: (...args) => formatters.formatWeatherTimestamp(...args),
  formatDuration: (...args) => formatters.formatDuration(...args),
  formatForecastOpeningTime: (...args) => formatters.formatForecastOpeningTime(...args),
  setDecisionSummary: (...args) => recommendationView.setDecisionSummary(...args),
  renderRecommendation: (...args) => recommendationView.renderRecommendation(...args),
  planLimitingExplanation: (...args) => recommendationView.planLimitingExplanation(...args),
  renderAhChart: (...args) => chart.renderAhChart(...args),
  renderReadingRulers: (...args) => readingControls.renderReadingRulers(...args),
});
const chart = createChart({
  state,
  formatShortTime: (...args) => formatters.formatShortTime(...args),
});
const readingControls = createReadingControls({
  state,
  elements,
  saveIndoorReadings: (...args) => storage.saveIndoorReadings(...args),
  savePlanSettings: (...args) => storage.savePlanSettings(...args),
  render: scheduleRender,
});
const dialogs = createDialogs({
  elements,
  dialogScrollLock,
});
const pageNavigation = createPageNavigation({
  renderChart: () => chart.renderAhChart(),
  suppressGestureClick: () => dialogs.suppressGestureClick(),
  canStartPointerGesture: event => dialogs.canStartPointerGesture(event),
});
const pullRefresh = createPullRefresh({
  state,
  elements,
  fetchWeather: (...args) => weatherController.fetchWeather(...args),
  isOverview: () => pageNavigation.isOverview(),
});
const pageLayout = createPageLayout({ preferences: uiPreferences, save: () => storage.saveUiPreferences(),
  canStartPointerGesture: event => dialogs.canStartPointerGesture(event) });
const events = createEvents({
  applyPageLayout: () => pageLayout.apply(),
  startCameraInput: () => cameraLoader.start(),
  state,
  elements,
  uiPreferences,
  dialogScrollLock,
  startVoiceInput: (...args) => { cameraLoader.cancel(); cameraController?.cancel({ focus: false }); return voiceController.startVoiceInput(...args); },
  toggleVoiceListening: (...args) => { cameraLoader.cancel(); cameraController?.cancel({ focus: false }); return voiceController.toggleVoiceListening(...args); },
  closeVoiceDialog: (...args) => voiceController.closeVoiceDialog(...args),
  applyVoiceChanges: (...args) => voiceController.applyVoiceChanges(...args),
  voiceSupported: voiceController.supported,
  saveIndoorReadings: (...args) => storage.saveIndoorReadings(...args),
  savePlanSettings: (...args) => storage.savePlanSettings(...args),
  saveUiPreferences: (...args) => storage.saveUiPreferences(...args),
  fetchWeather: (...args) => weatherController.fetchWeather(...args),
  handleLocationInput: (...args) => locationController.handleLocationInput(...args),
  handleLocationSearch: (...args) => locationController.handleLocationSearch(...args),
  useCurrentLocation: (...args) => locationController.useCurrentLocation(...args),
  openLocationDialog: (...args) => locationController.openLocationDialog(...args),
  closeLocationDialog: (...args) => locationController.closeLocationDialog(...args),
  cancelLocationWork: (...args) => locationController.cancelLocationWork(...args),
  render: scheduleRender,
  renderAhChart: (...args) => chart.renderAhChart(...args),
  bindTypedValue: (...args) => readingControls.bindTypedValue(...args),
  bindSteppers: (...args) => readingControls.bindSteppers(...args),
  bindReadingRulers: (...args) => readingControls.bindReadingRulers(...args),
  enableSheetDrag: (...args) => dialogs.enableSheetDrag(...args),
  bindSheetFocus: (...args) => dialogs.bindSheetFocus(...args),
  rememberSheetFocus: (...args) => dialogs.rememberSheetFocus(...args),
  restoreSheetFocus: (...args) => dialogs.restoreSheetFocus(...args),
  closeSheet: (...args) => dialogs.closeSheet(...args),
  openPlanDialog: (...args) => dialogs.openPlanDialog(...args),
  closePlanDialog: (...args) => dialogs.closePlanDialog(...args),
});
const lock = dialogs.createDialogScrollLock();
const timerController = createTimerController({
  state, elements, dialogScrollLock,
  renderRulers: () => readingControls.renderReadingRulers(),
  rememberSheetFocus: (...args) => dialogs.rememberSheetFocus(...args),
  restoreSheetFocus: (...args) => dialogs.restoreSheetFocus(...args),
  closeSheet: (...args) => dialogs.closeSheet(...args),
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");

storage.loadIndoorReadings();
storage.loadPlanSettings();
storage.loadUiPreferences();
voiceController.initializeVoiceDebugPanel();
const hasSavedLocation = storage.loadLocation();
locationController.loadLocationHistory(hasSavedLocation);
locationController.updateLocationUi();
// Give the timer help popup first refusal of Escape before shared dismissal.
timerController.initialize();
pageLayout.bind();
events.bindEvents();
document.querySelectorAll('.white-sheet').forEach(dialog => createSheetChrome({ dialog }).bind());
pageNavigation.bind();
pullRefresh.bindPullToRefresh();
dashboard.render();
locationController.initializeLocation(hasSavedLocation);
setInterval(weatherController.fetchWeather, WEATHER_REFRESH_INTERVAL_MS);
setInterval(readingControls.updateIndoorLastSetLabels, 60_000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    cameraLoader.cancel();
    voiceController.handleVoiceHidden();
    cameraController?.handleHidden();
    return;
  }
  readingControls.updateIndoorLastSetLabels();
  weatherController.updateWeatherCheckedLabel();
  if (!state.lastCheckedAt || formatters.minutesSince(state.lastCheckedAt) >= 15) weatherController.fetchWeather();
});
window.addEventListener("pagehide", () => { cameraLoader.cancel(); voiceController.handleVoiceHidden("page left"); cameraController?.handleHidden(); });
