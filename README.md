# Dew

A small personal ventilation checker for deciding whether opening windows should reduce indoor humidity.

## Phase 1 architecture

- Static mobile-first web app.
- Manual indoor temperature and relative humidity inputs.
- Outdoor temperature and relative humidity from Open-Meteo for Sale / Trafford, Greater Manchester.
- Browser-side calculations for dew point, absolute humidity, and outdoor relative humidity after warming indoors.
- Local storage remembers the manual indoor readings on the same device.

## Decision logic

The app compares absolute humidity in g/m3. If outdoor air contains at least 0.4 g/m3 less water than indoor air, it recommends opening windows. If it is wetter, or the difference is too small to matter, it recommends keeping windows closed.

## Later phases

- Improve installability and offline behaviour.
- Add richer loading and error states.
- Investigate whether Tado X readings can be accessed safely and reliably. The most promising routes are Home Assistant via Matter for local readings, or Tado's REST API through a small backend that can protect tokens and respect daily API limits.
- Add forecast-based recommendations.
