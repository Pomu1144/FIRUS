/** Geographic helpers. Pure functions, no DOM. */

const EARTH_RADIUS_MILES = 3958.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two [lat, lon] pairs. */
export function milesBetween(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/** Returns a copy of `places` with a `distanceMiles` field, nearest first. */
export function withDistance(places, origin) {
  if (!origin) return places.map((place) => ({ ...place, distanceMiles: null }));
  return places
    .map((place) => ({
      ...place,
      distanceMiles: milesBetween(origin.lat, origin.lon, place.lat, place.lon)
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export function formatDistance(miles) {
  if (miles == null || !Number.isFinite(miles)) return "";
  if (miles < 0.1) return "under 0.1 mi";
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Browser geolocation as a promise. Never rejects with a raw PositionError. */
export function requestUserLocation({ timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          location: { lat: position.coords.latitude, lon: position.coords.longitude }
        }),
      (error) =>
        resolve({
          ok: false,
          reason: error && error.code === 1 ? "denied" : "unavailable"
        }),
      { timeout, maximumAge: 300000, enableHighAccuracy: false }
    );
  });
}
