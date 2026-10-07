import { saturationVaporPressure, dewPoint, absoluteHumidity, relativeHumidityAtTemperature, compareMoisture } from '../domain/humidity.js';
import { buildWeatherTimeline as calculateBuildWeatherTimeline } from '../domain/forecast.js';
import { roomVolume as calculateRoomVolume, effectiveAirExchange as calculateEffectiveAirExchange, projectedDryAirHorizon as calculateProjectedDryAirHorizon, estimateOpeningWindowPlan as calculateEstimateOpeningWindowPlan, findNextUsefulOpeningTime } from '../domain/ventilation.js';
import { OPENING_SETUPS } from '../config.js';

export function createDashboard({
  state,
  elements,
  weatherUrlForLocation,
  formatTemp,
  formatRh,
  formatWeatherTimestamp,
  formatForecastOpeningTime,
  setDecisionSummary,
  renderRecommendation,
  planLimitingExplanation,
  renderAhChart,
  renderReadingRulers,
} = {}, environment = globalThis) {
  const { document } = environment;
  const buildWeatherTimeline = (...args) => calculateBuildWeatherTimeline(state, ...args);
  const roomVolume = (...args) => calculateRoomVolume(state, ...args);
  const projectedDryAirHorizon = (...args) => calculateProjectedDryAirHorizon(state, ...args);
  const estimateOpeningWindowPlan = (...args) => calculateEstimateOpeningWindowPlan(state, ...args);
  const effectiveAirExchange = (...args) => calculateEffectiveAirExchange(state, ...args);
  function formatPlanSummary() {
    const minimum = state.minTemp.toFixed(1).replace(/\.0$/, "");
    return `Min ${minimum}°C · Target ${formatRh(state.targetRh)} RH`;
  }

  function formatVentilationSummary() {
    const volume = roomVolume().toFixed(1).replace(/\.0$/, "");
    const opening = state.openingSetup === "custom"
      ? `Custom airflow · ${state.customAirflow.toFixed(1).replace(/\.0$/, "")} m³/h`
      : state.openingSetup === "single"
        ? "One window open"
        : OPENING_SETUPS[state.openingSetup]?.label ?? OPENING_SETUPS.single.label;
    return `${volume} m³ · ${opening}`;
  }

  function renderPlanControls() {
    elements.targetRh.value = state.targetRh;
    elements.minTemp.value = state.minTemp;
    if (document.activeElement !== elements.targetRhInput) elements.targetRhInput.value = Math.round(state.targetRh);
    if (document.activeElement !== elements.minTempInput) elements.minTempInput.value = state.minTemp.toFixed(1).replace(".0", "");
    elements.roomPreset.querySelectorAll('input').forEach(input => { input.checked = input.value === state.roomPreset; });
    for (const key of ['roomLength', 'roomWidth', 'roomHeight', 'customAirflow']) {
      if (document.activeElement !== elements[key]) elements[key].value = state[key];
    }
    elements.roomVolume.textContent = `${roomVolume().toFixed(1).replace(".0", "")} m³`;
    document.querySelector('#customRoomVolume').textContent = `${(state.roomLength * state.roomWidth * state.roomHeight).toFixed(1).replace('.0', '')} m³`;
    elements.customRoomFields.hidden = state.roomPreset !== "custom";
    elements.openingSetup.querySelectorAll('input').forEach(input => { input.checked = input.value === state.openingSetup; });
    elements.customFlowField.hidden = state.openingSetup !== "custom";
    elements.planSummaryText.textContent = formatPlanSummary();
    elements.planSummaryVentilationText.textContent = formatVentilationSummary();
  }

  function renderPlan() {
    renderPlanControls();
    const timeline = buildWeatherTimeline();
    if (!timeline.length || state.weatherRequestPending || state.weatherLoadFailed) {
      elements.planConfidence.textContent = state.weatherLoadFailed ? "Outdoor data unavailable" : "Waiting for outdoor data...";
      return null;
    }
    const current = timeline[0];
    const plan = estimateOpeningWindowPlan(current, timeline);
    if (plan.status === "good") plan.dryAirHorizon = projectedDryAirHorizon(current, timeline);
    const closed = ["below-minimum", "wetter"].includes(plan.status) ||
      (["too-cold", "condensation"].includes(plan.status) && !plan.limitMinutes);
    if (closed) plan.nextUsefulOpeningTime = findNextUsefulOpeningTime(state, timeline);
    elements.planConfidence.textContent = 'Est. ' + effectiveAirExchange(current, state.indoorTemp).airChangesPerHour.toFixed(1) + ' air changes/hr';
    return plan;
  }

  function renderRecommendationExplanation(plan, comparison, adjustedRh, condensationRisk) {
    if (state.weatherRequestPending || state.weatherLoadFailed || state.outdoorTemp === null || state.outdoorRh === null) {
      const locationName = state.location.name || "the selected location";
      elements.explanationText.textContent = state.weatherLoadFailed
        ? `Outdoor weather is unavailable for ${locationName}. A recommendation cannot be made until current data is available.`
        : `Checking outdoor weather for ${locationName}. The recommendation will appear when current data arrives.`;
      return;
    }

    const relationship = comparison.status === "drier"
      ? "Outdoor air is drier than the air indoors."
      : comparison.status === "wetter"
        ? "Outdoor air contains more moisture than the air indoors."
        : "The moisture difference between indoor and outdoor air is too small to be sure.";
    const nextWindow = plan.nextUsefulOpeningTime
      ? ` Assuming your indoor readings stay the same, the next suitable time to open windows for drying is forecast around ${formatForecastOpeningTime(plan.nextUsefulOpeningTime)}.`
      : "";
    elements.explanationText.textContent = `${relationship} ${planLimitingExplanation(plan, comparison)}${nextWindow}`;
  }

  function renderWeatherDataDetails() {
    elements.sourceLocationName.textContent = state.location.name || "Selected location";
    elements.liveWeatherRequest.href = weatherUrlForLocation(state.location);

    const lastSuccess = state.lastSuccessfulUpdateAt;
    if (state.weatherRequestPending) {
      elements.weatherDataStatus.textContent = lastSuccess
        ? `Weather refresh in progress. Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
        : "Weather update in progress. No successful update is available yet.";
    } else if (state.weatherLoadFailed) {
      const failedAt = state.lastCheckedAt
        ? `Latest refresh failed at ${formatWeatherTimestamp(state.lastCheckedAt)}.`
        : "The latest weather refresh failed.";
      elements.weatherDataStatus.textContent = lastSuccess
        ? `${failedAt} Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
        : `${failedAt} No successful weather data is available.`;
    } else {
      elements.weatherDataStatus.textContent = lastSuccess
        ? `Last successful update: ${formatWeatherTimestamp(lastSuccess)}.`
        : "No successful weather update is available yet.";
    }
  }

  function render() {
    renderAhChart();
    elements.indoorTemp.value = state.indoorTemp;
    elements.indoorRh.value = state.indoorRh;
    if (document.activeElement !== elements.indoorTempInput) elements.indoorTempInput.value = state.indoorTemp.toFixed(1);
    if (document.activeElement !== elements.indoorRhInput) elements.indoorRhInput.value = Math.round(state.indoorRh);
    renderReadingRulers();
    elements.indoorTempValue.textContent = formatTemp(state.indoorTemp);
    elements.indoorRhValue.textContent = formatRh(state.indoorRh);
    elements.indoorSummaryTemp.textContent = state.indoorTemp.toFixed(1);
    elements.indoorSummaryRh.textContent = String(Math.round(state.indoorRh));
    elements.warmingTemp.textContent = formatTemp(state.indoorTemp);

    const plan = renderPlan();
    renderWeatherDataDetails();
    const indoorDew = dewPoint(state.indoorTemp, state.indoorRh);
    const indoorAbsolute = absoluteHumidity(state.indoorTemp, state.indoorRh);
    elements.indoorDewPoint.textContent = formatTemp(indoorDew);
    elements.indoorAbsoluteHumidity.textContent = indoorAbsolute.toFixed(1);
    elements.outdoorAbsoluteHumidity.classList.remove("lower", "higher", "near");
    document.querySelector(".outdoor-card").classList.remove("lower", "higher", "near");

    const unavailable = state.weatherRequestPending || state.weatherLoadFailed || state.outdoorTemp === null || state.outdoorRh === null;
    elements.recommendation.dataset.weatherState = unavailable ? (state.weatherLoadFailed ? 'failed' : 'loading') : 'ready';
    elements.dashboardPanel.classList.toggle('weather-unavailable', unavailable);
    const refreshLabel = state.weatherLoadFailed ? 'Retry outdoor weather' : 'Refresh outdoor weather';
    elements.refreshWeather.setAttribute('aria-label', refreshLabel);
    elements.refreshWeather.title = refreshLabel;
    if (unavailable) {
      elements.recommendation.classList.remove("open", "windows", "closed", "caution");
      elements.decisionLabel.textContent = state.weatherLoadFailed
        ? "NO DATA"
        : "Checking";
      setDecisionSummary(
        state.weatherLoadFailed ? "Outdoor weather is currently unavailable." : "Getting local conditions...",
        state.weatherLoadFailed ? "Check your connection and try again." : "",
      );
      renderRecommendationExplanation(null, null, null, false);
      elements.outdoorTempValue.textContent = "--";
      elements.outdoorRhValue.textContent = "--";
      elements.outdoorDewPoint.textContent = "--";
      elements.outdoorAbsoluteHumidity.textContent = "--";
      elements.warmedOutdoorRh.textContent = "--";
      elements.adjustedAirNote.textContent = "";
      return;
    }

    const outdoorDew = Number.isFinite(state.outdoorDewPoint)
      ? state.outdoorDewPoint
      : dewPoint(state.outdoorTemp, state.outdoorRh);
    const comparison = compareMoisture(
      state.indoorTemp,
      state.indoorRh,
      state.outdoorTemp,
      state.outdoorRh,
    );
    const outdoorVaporPressure = saturationVaporPressure(outdoorDew);
    const adjustedRh = relativeHumidityAtTemperature(outdoorVaporPressure, state.indoorTemp);
    const condensationRisk = adjustedRh >= 100;
    const displayedAdjustedRh = Math.min(adjustedRh, 100);

    elements.outdoorTempValue.textContent = formatTemp(state.outdoorTemp);
    elements.outdoorRhValue.textContent = formatRh(state.outdoorRh);
    elements.outdoorDewPoint.textContent = formatTemp(outdoorDew);
    elements.outdoorAbsoluteHumidity.textContent = comparison.outdoor.toFixed(1);
    elements.warmedOutdoorRh.textContent = formatRh(displayedAdjustedRh);
    elements.adjustedAirNote.textContent = condensationRisk ? "Condensation risk" : "";
    elements.outdoorAbsoluteHumidity.classList.toggle("lower", comparison.status === "drier");
    elements.outdoorAbsoluteHumidity.classList.toggle("higher", comparison.status === "wetter");
    elements.outdoorAbsoluteHumidity.classList.toggle("near", comparison.status === "uncertain");

    document.querySelector(".outdoor-card").classList.add(comparison.status === "drier" ? "lower" : comparison.status === "wetter" ? "higher" : "near");

    renderRecommendation(plan);
    renderRecommendationExplanation(plan, comparison, displayedAdjustedRh, condensationRisk);
  }

  return { formatPlanSummary, formatVentilationSummary, renderPlanControls, renderPlan, renderRecommendationExplanation, renderWeatherDataDetails, render };
}
