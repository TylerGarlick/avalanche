/**
 * Proximity calculations using the Haversine formula
 * All distances are calculated in kilometers
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Sort items by distance from a user location
 */
export function sortByDistance<T>(
  items: T[],
  userLat: number,
  userLng: number,
  getCoords: (item: T) => [number, number]
): T[] {
  return [...items].sort((a, b) => {
    const [latA, lngA] = getCoords(a);
    const [latB, lngB] = getCoords(b);
    const distA = haversineDistance(userLat, userLng, latA, lngA);
    const distB = haversineDistance(userLat, userLng, latB, lngB);
    return distA - distB;
  });
}

/**
 * Get distance with cardinal direction
 * e.g., "2.3 km NE"
 */
export function getDistanceWithDirection(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string {
  const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
  const direction = getCardinalDirection(fromLat, fromLng, toLat, toLng);
  return `${distanceKm.toFixed(1)} km ${direction}`;
}

/**
 * Get cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
export function getCardinalDirection(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): string {
  const dLng = toLng - fromLng;
  const dLat = toLat - fromLat;

  // Handle edge case where points are essentially the same
  if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) {
    return '';
  }

  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const normalized = ((angle + 360) % 360) / 45;

  const directions = ['', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return directions[Math.round(normalized)];
}

/**
 * Convert km to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Format distance based on locale (US = imperial)
 */
export function formatDistance(
  distanceKm: number,
  useImperial: boolean = false
): string {
  if (useImperial) {
    const miles = kmToMiles(distanceKm);
    return `${miles.toFixed(1)} mi`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Check if locale is US (for imperial units)
 */
export function isUSLocale(): boolean {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || '';
    return lang.startsWith('en-US');
  }
  return false;
}
