# Moisture comparisons and opening estimates

**Audience:** People exploring the reasoning and calculation maintainers

**Status:** Current main reference; appearance and uniform glass sheets on the separate `dark-mode` branch remain Unreleased where labelled

**Owns:** Moisture interpretation, uncertainty, forecast advice and model assumptions

**Reviewed:** 14 October 2026

[Documentation index](../index.md) · [User guide](../user-guide.md)

## Contents

- [Reading the result](#reading-the-result)
- [How opening times are estimated](#how-opening-times-are-estimated)
- [Rain on the outdoor outlook](#rain-on-the-outdoor-outlook)

The recommendation is a planning estimate: compare moisture first, then consider the suggested opening period and its stopping limit. Take fresh readings during ventilation. The detail below explains why displayed RH or AH alone can be misleading.

## Reading the result

The recommendation compares indoor and outdoor moisture at the same reference temperature, accounting for uncertainty in the readings. **Why this recommendation?** explains whether outdoor air is drier and what drives the current result. When the difference is too small to be sure, it says so without presenting a numerical error calculation. **How estimates work** explains the main limitations and encourages fresh indoor readings during ventilation.

The cards show each reading's actual absolute humidity (AH) in grams per cubic metre; their colours reflect the shared-temperature comparison, so the colour need not follow the order of those two displayed numbers when the air temperatures differ. The **Let in** value estimates outdoor relative humidity after that air warms to the current indoor temperature.

The outlook starts at 48 hours and can switch to 24 hours. The curve shows actual outdoor AH against the actual indoor reference, and the bars show estimated air changes per hour (ACH). Along the curve, coral means reliably wetter, amber means within the uncertainty margin, and white means reliably drier after comparing air at the indoor temperature. Both ranges use the same 48-hour scales. Tap, drag or hover to inspect values; keyboard users can use arrow keys and Home/End.

## How opening times are estimated

Room volume, opening setup, forecast wind and the indoor–outdoor temperature difference determine estimated airflow. The app then simulates moisture and temperature minute by minute. Between hourly forecast points, humidity is derived from interpolated dew point.

The estimate stops when the humidity target is reached, the room would cool below its minimum, simulated room air reaches 100% humidity, or outdoor air stops being reliably drier. A room already below its minimum can still benefit from opening if the incoming air is warmer and reliably drier; the estimate stops if that room starts cooling again while still below its minimum. When both an estimated outcome time and a reliably drier period are shown, follow the earlier limit.

Useful drying can produce **OPEN WINDOWS** even when the target cannot be reached. The benefit check compares moisture before and after ventilation at the original indoor temperature and pressure. It requires at least a one-percentage-point reduction in this reference RH and a moisture reduction exceeding the existing uncertainty margin. This prevents cooling from hiding moisture removal and warming from being mistaken for drying. Reaching the target still uses the actual predicted RH during ventilation and the existing moisture-margin check. Small or uncertain reductions produce **OPEN IF NEEDED**; harmful conditions produce **KEEP CLOSED**. At temperature and saturation limits, the benefit check uses the last permitted state, before the limit is breached.

Cooling can keep the humidity reading high even while ventilation removes moisture. The reading may fall as the room warms again, provided moisture is not added or released back into the air. The reference-temperature comparison is not a prediction of when heating will restore the room temperature.

**Why this recommendation?** gives a short overview of the cause and practical action. It repeats relevant opening durations from Overview so the advice can be read on its own, without repeating the verdict target. Confident moisture comparisons show approximately how much less or more moisture outdoor air contains at the same indoor temperature. Uncertain readings make no confident drying claim. Each result explains its actual limit: changing outdoor weather, diminishing benefit, cooling, room-air saturation or little noticeable progress. The longer drier-air window describes how long opening may keep helping; close when your target is reached. Cooling can leave the humidity reading high even while moisture leaves.

Rooms that warm initially and then start cooling have a separate stopping explanation.

Open **More detail** for densities in g/m³, outdoor RH at the indoor temperature, rain amounts and chance, wind speed, room/opening assumptions and estimated airflow. It starts collapsed on page load and keeps your choice through updates. Weather loading or failure hides old advice temporarily; recovery restores the disclosure state. The drier-air window follows the changing room as it dries and cools and does not assess rain entering windows or comfort limits. Capped windows reach the model's limit; they do not establish when drying stops. Missing forecast coverage is explicit, and estimates beyond coverage hold the last available weather unchanged.

Rain advice covers forecast hours overlapping the suggested opening period (or the next hour without a useful opening period). The overview shows severity and relevant actions; More detail shows the highest hourly amount and available precipitation chance. Rain and wind facts accompany every current result, but closed and target-met outcomes do not encourage opening. Amounts include rain and showers, not snow; probability can include snow. Hourly averages use light ≤2.5 mm, moderate >2.5–7.5 mm and heavy >7.5 mm, following [Environment and Climate Change Canada’s intensity categories](https://www.climat.weather.gc.ca/glossary_e.html). Brief showers can be heavier; overlapping hours are not prorated into an invented opening-period total. Missing coverage is explicit.

Drying can still help during rain, but open only where water cannot enter and wait if rain is heavy at your window. This advice does not change the drying verdict or duration. [Open-Meteo’s documentation](https://open-meteo.com/en/docs) defines hourly amounts as preceding-hour accumulations.

The wind overview names the direction it comes **from**; More detail also names where it blows towards and the reported 10m speed. Unavailable speed is separate from the calculation fallback, so missing data is never described as calm. Prefer sheltered windows and avoid windows facing the incoming wind when rain blows towards them. The app does not know window positions, building shelter or gusts; calm and unavailable directions do not identify a window side. Windward exposure matters particularly in storms; see [Met Office storm advice](https://weather.metoffice.gov.uk/warnings-and-advice/seasonal-advice/your-home/stay-safe-in-a-storm).

For **KEEP CLOSED**, **Why this recommendation?** adds the next suitable time to open windows for drying when one is found, explicitly assuming the indoor readings stay the same. The app checks each future minute up to 48 hours ahead, regardless of the chart's selected range, and applies the same ventilation settings and drying/temperature rules. Each candidate simulation uses at most three hours and stops at the end of available forecast coverage; it does not extend the last weather reading. The time is shown in the location's time zone, with tomorrow or the weekday when needed. Take fresh indoor readings before opening then. No future-time sentence is shown when no qualifying window is found or weather is unavailable.

If a room starts below its minimum, warmer outdoor air may allow a useful ventilation period. If that air subsequently starts cooling the room while it remains below its minimum, the verdict uses the existing useful-drying duration instead of claiming a time to reach the minimum temperature.

These are planning estimates, not measurements. Actual airflow depends on the building, window geometry, doors, wind and pressure differences. Forecast recommendations assume the current indoor readings remain unchanged until each displayed start time.

The model mixes moisture in the room's air and allows for a slower temperature response, but does not simulate moisture stored in walls, furniture or fabrics. Those materials can release moisture while the air dries and make humidity rise again after the windows close. Ongoing moisture from people, cooking, showers and drying clothes is not included. Active heating is not simulated either, so actual room temperature can behave differently from the estimate.

Higher humidity makes condensation more likely on cold windows and walls. The app checks whether room air reaches 100% humidity, but does not predict condensation on those colder surfaces. Condensation can form below 100% room humidity if a surface is cold enough; the app does not estimate surface temperatures.

The moisture comparison uses fixed uncertainty allowances: ±0.3°C and ±2 percentage points of indoor humidity, and ±0.5°C and ±3 percentage points of outdoor humidity. These are assumptions, not a guarantee of your sensor's or forecast's accuracy. The same allowances apply to every forecast hour; they do not increase further into the forecast. The humidity allowance means, for example, 60% ±2 points is 58–62%, not a 2% change in the reading. These allowances help identify unclear moisture differences; they do not cover every source of error in opening times.

Take fresh temperature and humidity readings during ventilation, and close the windows sooner if the room gets too cold. A reading after closing can also show whether humidity has risen again.

## Rain on the outdoor outlook

Translucent white bars descend from the top of the chart and show forecast liquid rainfall (rain plus showers) for each hour. Subtle hatched bands mark consecutive hours with at least 0.1 mm. The rain scale is shared between the 24- and 48-hour views; ACH bars still span two hours and show air changes per hour.

Read Chart key on Overview for the Lines and Bars & markers groups. Outdoor AH colours show whether ventilation would dry the indoor air; they do not indicate rainfall. Rain bars cover one hour, and ≥ marks an incomplete rain-spell total. The key stays expanded in a two-column card, with Lines and Bars & markers headings. Rain amount uses 1-hour bars; rain-period hatching marks shaded hours. ACH bars cover two-hour intervals and use the same height scale in both views; the 24-hour view shows numbers and wind arrows in a separate strip beneath the proportional bars. Arrows point where the wind is blowing. Tap or drag the chart, or use its arrow keys, to change the selected time.

Accessible inspection text includes hourly rainfall, precipitation chance and spell totals; there is no separate visual rain-detail table. Precipitation chance may include snow. Forecast rain is advisory and does not change the drying verdict or suggested opening duration.

Totals above bands add the known hourly amounts in each spell. A ≥ prefix marks a spell clipped by the displayed range or incomplete data. For clipped spells, only complete visible hours contribute to the subtotal; rainfall is never prorated for a partial hour. Labels are omitted where they cannot fit; inspection still shows the total. Missing rain is reported as unavailable, never as dry weather. Hourly forecasts do not establish an exact minute when rain starts.

Weather data lists the provider, requested location and last successful update, with separate messages for pending or failed refreshes. Before the first success, Last update says Not available yet. Source documentation and View weather data open separately. Glossary stacks each abbreviation and full name above its definition for narrow screens and enlarged text. More detail groups information under Moisture, Drier-air window, Rain, Wind and Model assumptions; only applicable entries appear.

Supporting sections use larger headings to distinguish them from smaller content labels. Chart key on Overview and Why this recommendation? on Why have permanent headings; Glossary, How estimates work and Weather data are native disclosures. More detail remains a compact underlined control inside Why this recommendation?; each disclosure opens independently.
