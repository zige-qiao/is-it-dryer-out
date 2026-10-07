import { compareMoisture, vaporPressure, relativeHumidityAtTemperature } from '../domain/humidity.js';
import { MAX_OPEN_MINUTES, MINIMUM_NOTICEABLE_RH_CHANGE } from '../config.js';
import { validTimerMinutes } from './timer.js';

export function createRecommendationView({
  state,
  elements,
  formatTemp,
  formatRh,
  formatDuration,
  timerSupported = false,
} = {}, environment = globalThis) {
  const { document } = environment;

  function setDecisionLine(element, text, emphasizedDuration, emphasizeWhole, timer) {
    element.replaceChildren();
    if (emphasizedDuration && text.includes(emphasizedDuration)) {
      const [prefix, suffix] = text.split(emphasizedDuration);
      const interactive = timerSupported && validTimerMinutes(timer?.minutes);
      const duration = document.createElement(interactive ? "button" : "strong");
      duration.textContent = emphasizedDuration;
      if (interactive) {
        duration.type = 'button';
        duration.className = 'verdict-time';
        duration.dataset.timerMinutes = timer.minutes;
        duration.dataset.timerContext = timer.context;
        duration.setAttribute('aria-label', `Set timer for ${emphasizedDuration}: ${timer.context}`);
        duration.setAttribute('aria-haspopup', 'dialog');
        duration.setAttribute('aria-controls', 'timerDialog');
        duration.setAttribute('aria-expanded', 'false');
        duration.title = 'Set ventilation timer';
      }
      element.append(prefix, duration, suffix);
      return;
    }

    if (emphasizeWhole) {
      const emphasis = document.createElement("strong");
      emphasis.textContent = text;
      element.append(emphasis);
      return;
    }

    element.textContent = text;
  }

  function setDecisionSummary(primary, secondary, primaryDuration, secondaryDuration, primaryTimer, secondaryTimer) {
    setDecisionLine(elements.decisionPrimary, primary, primaryDuration, true, primaryTimer);
    setDecisionLine(elements.decisionSecondary, secondary, secondaryDuration, false, secondaryTimer);
  }

  function planTone(plan) {
    if (plan.status === "target-met") return "open";
    if (["good", "slow"].includes(plan.status)) return "windows";
    if (
      ["forecast-limit", "settling", "too-cold", "condensation"].includes(plan.status) &&
      (plan.minutes ?? plan.limitMinutes)
    ) {
      return "windows";
    }
    if (["below-minimum", "wetter"].includes(plan.status)) return "closed";
    if (["too-cold", "condensation"].includes(plan.status)) return "closed";
    return "caution";
  }

  function setToneClass(element, tone) {
    element.classList.remove("tone-open", "tone-windows", "tone-caution", "tone-closed");
    element.classList.add(`tone-${tone}`);
  }

  function renderRecommendation(plan) {
    elements.recommendation.classList.remove("open", "windows", "closed", "caution");
    elements.recommendation.classList.add(planTone(plan));
    const limited = ["too-cold", "condensation"].includes(plan.status);
    const readings = [state.indoorTemp, state.indoorRh, state.outdoorTemp, state.outdoorRh];
    const drier = readings.every(Number.isFinite) && compareMoisture(...readings).status === "drier";
    const rhAtOriginalTemp = relativeHumidityAtTemperature(
      vaporPressure(plan.projectedTemp, plan.projectedRh), state.indoorTemp,
    );
    const coolingLimitsBenefit = plan.projectedTemp < state.indoorTemp &&
      state.indoorRh - rhAtOriginalTemp >= MINIMUM_NOTICEABLE_RH_CHANGE &&
      state.indoorRh - plan.projectedRh < MINIMUM_NOTICEABLE_RH_CHANGE;
    const limitedBenefitLine = drier
      ? coolingLimitsBenefit
        ? "Drier out, but limited benefit as the room cools."
        : "Drier out, but little drying benefit expected."
      : "Open for fresh air, humidity may not fall.";

    if (plan.status === "target-met") {
      elements.decisionLabel.textContent = "TARGET MET";
      setDecisionSummary(
        `At or near your ${formatRh(state.targetRh)} target.`,
        drier ? "Drier out, but your humidity target is already met." : "No ventilation needed now.",
      );
    } else if (plan.status === "below-minimum") {
      elements.decisionLabel.textContent = "KEEP CLOSED";
      setDecisionSummary(
        `Room is below your ${formatTemp(state.minTemp)} minimum.`,
        drier ? "Drier out, but opening would cool it further." : "Ventilation would cool it further.",
      );
    } else if (plan.status === "wetter") {
      elements.decisionLabel.textContent = "KEEP CLOSED";
      setDecisionSummary(
        "Outdoor air contains more moisture.",
        "Opening would likely raise indoor humidity.",
      );
    } else if (plan.status === "uncertain") {
      elements.decisionLabel.textContent = "OPEN IF NEEDED";
      setDecisionSummary(
        "No clear drying benefit.",
        "Open for fresh air; drying benefit is uncertain.",
      );
    } else if (plan.status === "good") {
      elements.decisionLabel.textContent = "OPEN WINDOWS";
      const targetDuration = formatDuration(plan.minutes);
      const dryDuration = formatDuration(plan.dryAirHorizon.minutes);
      setDecisionSummary(
        `About ${targetDuration} to reach ${formatRh(state.targetRh)} RH.`,
        plan.dryAirHorizon.capped
          ? `At least ${dryDuration} of reliably drier air.`
          : `Up to ${dryDuration} of reliably drier air.`,
        targetDuration,
        dryDuration,
        { minutes: plan.minutes, context: 'About this long to reach your target humidity.' },
        { minutes: plan.dryAirHorizon.minutes, context: 'Outside air should stay drier for this long. You may not need to keep the windows open the whole time.' },
      );
    } else if (plan.status === "forecast-limit") {
      elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
      const limitDuration = formatDuration(plan.limitMinutes);
      setDecisionSummary(
        plan.limitMinutes
          ? `Up to ${limitDuration} of reliably drier forecast air.`
          : "No clear drying benefit.",
        plan.limitMinutes
          ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
          : limitedBenefitLine,
        plan.limitMinutes ? limitDuration : null,
        null,
        { minutes: plan.limitMinutes, context: 'Reliably drier forecast-air limit.' },
      );
    } else if (plan.status === "settling") {
      elements.decisionLabel.textContent = plan.minutes ? "OPEN WINDOWS" : "OPEN IF NEEDED";
      const settlingDuration = formatDuration(plan.minutes);
      setDecisionSummary(
        plan.minutes
          ? `Up to ${settlingDuration} of useful drying.`
          : "No clear drying benefit.",
        plan.minutes
          ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
          : limitedBenefitLine,
        plan.minutes ? settlingDuration : null,
        null,
        { minutes: plan.minutes, context: 'Estimated useful drying period.' },
      );
    } else if (limited) {
      elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "KEEP CLOSED";
      const limitDuration = formatDuration(plan.limitMinutes);
      const coldRoomReversal = plan.status === "too-cold" && plan.limitMinutes &&
        state.indoorTemp < state.minTemp && plan.projectedTemp < state.minTemp;
      const primary =
        plan.status === "too-cold"
          ? plan.limitMinutes
            ? coldRoomReversal
              ? `Up to ${limitDuration} of useful drying.`
              : `${limitDuration} to min indoor temperature.`
            : `Opening would drop it below ${formatTemp(state.minTemp)} now.`
          : plan.limitMinutes
            ? `${limitDuration} until condensation risk rises.`
            : "Opening may cause condensation now.";
      const secondary =
        plan.status === "condensation" && plan.limitMinutes
          ? "Stop then to limit condensation risk."
          : plan.limitMinutes
            ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
            : plan.status === "too-cold"
              ? "Opening would cool the room too much."
              : "Opening may increase condensation risk.";
      const timerContext = plan.status === 'too-cold'
        ? coldRoomReversal
          ? 'Stop before the room starts cooling again below its minimum temperature.'
          : 'Estimated time to minimum indoor temperature.'
        : 'Estimated time until condensation risk rises.';
      setDecisionSummary(
        primary,
        secondary,
        plan.limitMinutes ? limitDuration : null,
        null,
        { minutes: plan.limitMinutes, context: timerContext },
      );
    } else if (plan.status === "slow") {
      elements.decisionLabel.textContent = "OPEN WINDOWS";
      const modelDuration = formatDuration(MAX_OPEN_MINUTES);
      setDecisionSummary(
        `More than ${modelDuration} to reach ${formatRh(state.targetRh)} RH.`,
        `Recheck within ${modelDuration}; drying will be slow.`,
        modelDuration,
        modelDuration,
        { minutes: MAX_OPEN_MINUTES, context: 'Recheck reminder; the humidity target may take longer.' },
        { minutes: MAX_OPEN_MINUTES, context: 'Recheck reminder; the humidity target may take longer.' },
      );
    } else if (plan.status === "minimal-impact") {
      elements.decisionLabel.textContent = "OPEN IF NEEDED";
      setDecisionSummary(
        "No clear drying benefit.",
        limitedBenefitLine,
      );
    } else {
      elements.decisionLabel.textContent = "WAIT";
      setDecisionSummary("No clear drying benefit.", "Check conditions again later.");
    }
  }

  function planLimitingExplanation(plan, comparison) {
    let explanation = planLimitExplanation(plan);
    const useful = ["good", "slow", "settling", "forecast-limit", "too-cold", "condensation"].includes(plan.status) &&
      (plan.minutes ?? plan.limitMinutes) > 0;
    if (useful && plan.projectedTemp < state.indoorTemp &&
      state.indoorRh - plan.projectedRh < MINIMUM_NOTICEABLE_RH_CHANGE) {
      explanation = `Ventilation is expected to remove moisture, but cooling can keep the humidity reading high. The reading may fall as the room warms again. ${explanation}`;
    }
    return explanation;
  }

  function planLimitExplanation(plan) {
    const limitedAfter = Number.isFinite(plan.limitMinutes) && plan.limitMinutes > 0
      ? `after about ${formatDuration(plan.limitMinutes)}`
      : "almost immediately";

    switch (plan.status) {
      case "target-met":
        return `Indoor humidity is already at or near your ${formatRh(state.targetRh)} target, so opening is not needed to reduce humidity now.`;
      case "below-minimum":
        return `The room is already below your ${formatTemp(state.minTemp)} minimum, so opening would cool it further.`;
      case "wetter":
        return "Opening could raise indoor humidity.";
      case "uncertain":
        return "Open briefly if you need fresh air; humidity may not fall.";
      case "good":
        return `Opening is estimated to reach your ${formatRh(state.targetRh)} humidity target in about ${formatDuration(plan.minutes)}.`;
      case "forecast-limit":
        return plan.limitMinutes
          ? `Outdoor air is expected to stop being clearly drier ${limitedAfter}.`
          : "Outdoor air is not expected to stay clearly drier long enough to help reduce humidity.";
      case "settling":
        return `Indoor and outdoor moisture levels are expected to become too similar for further clear drying ${limitedAfter}.`;
      case "too-cold":
        if (state.indoorTemp < state.minTemp && plan.projectedTemp < state.minTemp) {
          return plan.limitMinutes
            ? `The room is already below your ${formatTemp(state.minTemp)} minimum. Ventilation would start cooling it again ${limitedAfter}.`
            : `The room is already below your ${formatTemp(state.minTemp)} minimum. Opening would cool it further almost immediately.`;
        }
        return plan.limitMinutes
          ? `The room is estimated to reach your ${formatTemp(state.minTemp)} minimum ${limitedAfter}.`
          : `Opening would cool the room below your ${formatTemp(state.minTemp)} minimum almost immediately.`;
      case "condensation":
        return `Room air is expected to reach 100% humidity ${limitedAfter}. This does not assess condensation on cold windows or walls.`;
      case "slow":
        return `Some drying is expected, but your humidity target is not reached in the ${MAX_OPEN_MINUTES / 60}-hour estimate.`;
      case "minimal-impact": {
        return "Only a small or uncertain moisture reduction is expected within the estimated ventilation period.";
      }
      default:
        return "There is no clear drying benefit under your current settings.";
    }
  }

  return { setDecisionLine, setDecisionSummary, planTone, setToneClass, renderRecommendation, planLimitingExplanation };
}
