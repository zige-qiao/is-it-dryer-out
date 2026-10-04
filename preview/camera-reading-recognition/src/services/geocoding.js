import { GEOCODING_ENDPOINT, UK_POSTCODE_ENDPOINT, UK_OUTCODE_ENDPOINT, REVERSE_GEOCODING_ENDPOINT, LOCATION_LABEL_OVERRIDES } from '../config.js';

export function createGeocoding({  } = {}, environment = globalThis) {
  const { navigator, fetch } = environment;

  function formatBrowserLocation(data) {
    const locality = data.locality || data.city || "Nearby location";
    const county = data.localityInfo?.administrative?.find((item) =>
      /county/i.test(item.description || ""),
    )?.name;
    const area = county || (data.city !== locality ? data.city : data.principalSubdivision);
    const label = area && area !== locality ? `${locality}, ${area}` : locality;
    return LOCATION_LABEL_OVERRIDES.get(label) || label;
  }

  async function reverseGeocodeLocation(latitude, longitude) {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: "en" });
    const response = await fetch(`${REVERSE_GEOCODING_ENDPOINT}?${params}`);
    if (!response.ok) throw new Error("Reverse geocoding failed");
    return formatBrowserLocation(await response.json());
  }

  function formatSearchLocation(result) {
    if (result.source === "postcode") {
      return [result.postcode, result.admin_district || result.region].filter(Boolean).join(", ");
    }
    if (result.source === "outcode") {
      const districts = Array.isArray(result.admin_district)
        ? result.admin_district.filter(Boolean).join(" / ")
        : result.admin_district;
      return [result.outcode, districts].filter(Boolean).join(", ");
    }
    const parts = [result.name, result.admin2 || result.admin1, result.country].filter(Boolean);
    return [...new Set(parts)].join(", ");
  }

  function normalizeUkPostcode(query) {
    const compact = query.toUpperCase().replace(/\s+/g, "");
    if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) return null;
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }

  function normalizeUkOutcode(query) {
    const compact = query.toUpperCase().replace(/\s+/g, "");
    return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact) ? compact : null;
  }

  async function searchUkPostcode(postcode) {
    const response = await fetch(`${UK_POSTCODE_ENDPOINT}/${encodeURIComponent(postcode)}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error("Postcode search failed");
    const data = await response.json();
    if (!data.result) return [];
    return [{ ...data.result, source: "postcode" }];
  }

  async function searchUkOutcode(outcode) {
    const response = await fetch(`${UK_OUTCODE_ENDPOINT}/${encodeURIComponent(outcode)}`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error("Outward-code search failed");
    const data = await response.json();
    if (!data.result) return [];
    return [{ ...data.result, source: "outcode" }];
  }

  function locationMatchesQualifier(result, qualifier) {
    if (!qualifier) return true;
    const fields = [result.admin1, result.admin2, result.admin3, result.admin4, result.country];
    return fields.some((field) => field?.toLowerCase().includes(qualifier.toLowerCase()));
  }

  async function searchTownLocations(query, worldwide = false) {
    const [town, qualifier = ""] = query.split(",", 2).map((part) => part.trim());
    const params = new URLSearchParams({
      name: worldwide ? query : town,
      count: worldwide ? "5" : "20",
      language: "en",
      format: "json",
    });
    if (!worldwide) params.set("countryCode", "GB");
    const response = await fetch(`${GEOCODING_ENDPOINT}?${params}`);
    if (!response.ok) throw new Error("Location search failed");
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (worldwide) return results.slice(0, 5);
    if (!qualifier) return results.slice(0, 4);

    const matching = results.filter((result) => locationMatchesQualifier(result, qualifier));
    return (matching.length ? matching : results).slice(0, 4);
  }

  async function searchLocations(query, worldwide = false) {
    const postcode = normalizeUkPostcode(query);
    if (postcode && !worldwide) return searchUkPostcode(postcode);
    const outcode = normalizeUkOutcode(query);
    if (outcode && !worldwide) return searchUkOutcode(outcode);
    return searchTownLocations(query, worldwide);
  }

  function isUkPostcodeQuery(query) {
    return Boolean(normalizeUkPostcode(query) || normalizeUkOutcode(query));
  }

  function getBrowserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported by this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  return { formatBrowserLocation, reverseGeocodeLocation, formatSearchLocation, normalizeUkPostcode, normalizeUkOutcode, searchUkPostcode, searchUkOutcode, locationMatchesQualifier, searchTownLocations, searchLocations, isUkPostcodeQuery, getBrowserLocation };
}
