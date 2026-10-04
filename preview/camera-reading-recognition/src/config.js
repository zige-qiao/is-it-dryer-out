

export const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export const GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

export const UK_POSTCODE_ENDPOINT = "https://api.postcodes.io/postcodes";

export const UK_OUTCODE_ENDPOINT = "https://api.postcodes.io/outcodes";

export const REVERSE_GEOCODING_ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

export const DEFAULT_LOCATION = {
  name: "Sale, Greater Manchester",
  latitude: 53.4252,
  longitude: -2.3244,
};

export const LOCATION_LABEL_OVERRIDES = new Map([
  ["Stretford, Greater Manchester", "Sale, Greater Manchester"],
]);

export const STORAGE_KEY = "camera-preview-dew-indoor-readings";

export const PLAN_STORAGE_KEY = "camera-preview-is-it-dryer-out-plan";

export const UI_PREFERENCES_STORAGE_KEY = "camera-preview-is-it-dryer-out-ui-preferences";

export const LOCATION_STORAGE_KEY = "camera-preview-is-it-dryer-out-location";

export const LOCATION_HISTORY_STORAGE_KEY = "camera-preview-is-it-dryer-out-location-history";

export const LOCATION_REQUESTED_STORAGE_KEY = "camera-preview-is-it-dryer-out-location-requested";

export const DEFAULT_TIMEZONE = "Europe/London";

export const DEFAULT_PRESSURE_HPA = 1013.25;

export const MINIMUM_MOISTURE_MARGIN = 0.4;

export const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export const MAX_OPEN_MINUTES = 180;

export const TARGET_MARGIN_RH = 0.5;

export const MINIMUM_NOTICEABLE_RH_CHANGE = 1;

export const THERMAL_RESPONSE_FACTOR = 0.22;

export const ROOM_PRESETS = { small: 30, medium: 50, large: 80 };

export const OPENING_SETUPS = {
  slightly: { label: "Window slightly open", airflow: 25 },
  single: { label: "One window fully open", airflow: 80 },
  cross: { label: "Cross-ventilation", airflow: 180 },
};

export const APP_BUILD_VERSION = "camera-reading-recognition (5b89953)";

export const VOICE_SILENCE_DURATION_MS = 1000;

export const VOICE_CLEANUP_TIMEOUT_MS = 3000;

export const VOICE_START_TIMEOUT_MS = 6000;

export const VOICE_MAX_DURATION_MS = 15000;

export const VOICE_IOS_MAX_DURATION_MS = 30000;

export const VOICE_METER_CALIBRATION_MS = 600;

export const VOICE_MIN_ACTIVITY_THRESHOLD = 0.018;

export const INPUT_UNCERTAINTY = {
  indoorTemp: 0.3,
  indoorRh: 2,
  outdoorTemp: 0.5,
  outdoorRh: 3,
};
