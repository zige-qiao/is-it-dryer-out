import { equivalentAbsoluteHumidity } from '../domain/humidity.js';
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

    if (plan.status === "target-met") {
      elements.decisionLabel.textContent = "TARGET MET";
      setDecisionSummary(
        `At or near your ${formatRh(state.targetRh)} target.`,
        "No ventilation needed now.",
      );
    } else if (plan.status === "below-minimum") {
      elements.decisionLabel.textContent = "KEEP CLOSED";
      setDecisionSummary(
        `Room is below your ${formatTemp(state.minTemp)} minimum.`,
        "Ventilation would cool it further.",
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
        "Open briefly for fresh air; humidity may not fall.",
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
          : "Open briefly for fresh air; humidity may not fall.",
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
          : "Open briefly for fresh air; humidity may not fall.",
        plan.minutes ? settlingDuration : null,
        null,
        { minutes: plan.minutes, context: 'Estimated useful drying period.' },
      );
    } else if (limited) {
      elements.decisionLabel.textContent = plan.limitMinutes ? "OPEN WINDOWS" : "KEEP CLOSED";
      const limitDuration = formatDuration(plan.limitMinutes);
      const primary =
        plan.status === "too-cold"
          ? plan.limitMinutes
            ? `${limitDuration} to min indoor temperature.`
            : `Opening would drop it below ${formatTemp(state.minTemp)} now.`
          : plan.limitMinutes
            ? `${limitDuration} until condensation risk rises.`
            : "Opening may cause condensation now.";
      const secondary =
        plan.status === "condensation" && plan.limitMinutes
          ? "Stop then to limit condensation risk."
          : plan.limitMinutes
            ? `Estimated then: ${formatRh(plan.projectedRh)} RH at ${formatTemp(plan.projectedTemp)}.`
            : "No useful opening time is available.";
      setDecisionSummary(
        primary,
        secondary,
        plan.limitMinutes ? limitDuration : null,
        null,
        { minutes: plan.limitMinutes, context: plan.status === 'too-cold' ? 'Estimated time to minimum indoor temperature.' : 'Estimated time until condensation risk rises.' },
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
        "Open briefly for fresh air; humidity may not fall.",
      );
    } else {
      elements.decisionLabel.textContent = "WAIT";
      setDecisionSummary("No clear drying benefit.", "Check conditions again later.");
    }
  }

  function planLimitingExplanation(plan, comparison) {
    const limitedAfter = Number.isFinite(plan.limitMinutes) && plan.limitMinutes > 0
      ? `after about ${formatDuration(plan.limitMinutes)}`
      : "almost immediately";

    switch (plan.status) {
      case "target-met":
        return `indoor humidity is already at or near your ${formatRh(state.targetRh)} target, so ventilation is not needed now.`;
      case "below-minimum":
        return `the room is already below your ${formatTemp(state.minTemp)} minimum, so opening would cool it further.`;
      case "wetter":
        return "opening would bring in air with more moisture and could raise indoor humidity.";
      case "uncertain":
        return "the model therefore recommends opening only if needed for fresh air.";
      case "good":
        return `the model estimates about ${formatDuration(plan.minutes)} to reach your ${formatRh(state.targetRh)} target.`;
      case "forecast-limit":
        return plan.limitMinutes
          ? `forecast air is expected to stop being reliably drier ${limitedAfter}.`
          : "the forecast does not stay reliably drier long enough for useful airing.";
      case "settling":
        return `the simulated indoor-outdoor moisture difference no longer clears the uncertainty allowance ${limitedAfter}.`;
      case "too-cold":
        return plan.limitMinutes
          ? `the room is estimated to reach your ${formatTemp(state.minTemp)} minimum ${limitedAfter}.`
          : `the room would fall below your ${formatTemp(state.minTemp)} minimum almost immediately.`;
      case "condensation":
        return plan.limitMinutes
          ? `the model predicts condensation risk ${limitedAfter}.`
          : "the model predicts condensation risk almost immediately.";
      case "slow":
        return `the model projects some drying, but does not reach your target within its ${MAX_OPEN_MINUTES / 60}-hour simulation.`;
      case "minimal-impact": {
        const projectedRhDrop = state.indoorRh - plan.projectedRh;
        if (projectedRhDrop < MINIMUM_NOTICEABLE_RH_CHANGE) {
          return "With this plan, opening a window isn't expected to lower the indoor humidity reading by even one percentage point.";
        }
        const projectedMoisture = equivalentAbsoluteHumidity(plan.projectedTemp, plan.projectedRh, state.indoorTemp);
        if (comparison.indoor - projectedMoisture <= comparison.margin) {
          return "With this plan, the expected moisture reduction is within the margin of error, so the change is unclear.";
        }
        return "With this plan, the model does not predict a clear reduction in indoor moisture.";
      }
      default:
        return "the model does not find a clear drying benefit under the current settings.";
    }
  }

  return { setDecisionLine, setDecisionSummary, planTone, setToneClass, renderRecommendation, planLimitingExplanation };
}
