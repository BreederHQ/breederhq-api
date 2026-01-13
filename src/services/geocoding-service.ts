// src/services/geocoding-service.ts
// Geocoding service for converting addresses/zip codes to lat/lng coordinates
//
// Uses OpenStreetMap Nominatim API (free, no API key required)
// Rate limit: 1 request per second (enforced by simple delay)
//
// Usage:
//   const coords = await geocodeAddress("Austin, TX");
//   const coords = await geocodeZipCode("78701");
//   const coords = await geocodeZipCode("78701", "US");

interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  placeType: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  class: string;
}

// Simple in-memory cache to avoid repeated lookups
const geocodeCache = new Map<string, GeocodingResult>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cacheTimestamps = new Map<string, number>();

// Rate limiting - Nominatim requires 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100; // 1.1 seconds to be safe

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "BreederHQ-Marketplace/1.0 (contact@breederhq.com)",
      "Accept": "application/json",
    },
  });
}

function getCacheKey(query: string): string {
  return query.toLowerCase().trim();
}

function getCached(key: string): GeocodingResult | null {
  const cached = geocodeCache.get(key);
  const timestamp = cacheTimestamps.get(key);

  if (cached && timestamp && (Date.now() - timestamp) < CACHE_TTL_MS) {
    return cached;
  }

  // Expired or not found
  geocodeCache.delete(key);
  cacheTimestamps.delete(key);
  return null;
}

function setCache(key: string, result: GeocodingResult): void {
  geocodeCache.set(key, result);
  cacheTimestamps.set(key, Date.now());

  // Simple cache size limit (1000 entries)
  if (geocodeCache.size > 1000) {
    const firstKey = geocodeCache.keys().next().value;
    if (firstKey) {
      geocodeCache.delete(firstKey);
      cacheTimestamps.delete(firstKey);
    }
  }
}

/**
 * Geocode a full address to lat/lng coordinates
 * @param address Full address string (e.g., "123 Main St, Austin, TX 78701")
 * @returns Geocoding result or null if not found
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const cacheKey = getCacheKey(address);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NominatimResponse[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const result: GeocodingResult = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      placeType: data[0].type,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Geocode a US zip code to lat/lng coordinates
 * @param zipCode 5-digit US zip code
 * @param countryCode Optional country code (default: "US")
 * @returns Geocoding result or null if not found
 */
export async function geocodeZipCode(zipCode: string, countryCode: string = "US"): Promise<GeocodingResult | null> {
  const cacheKey = getCacheKey(`zip:${zipCode}:${countryCode}`);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Use postalcode search for better accuracy
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zipCode)}&countrycodes=${countryCode}&format=json&limit=1`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NominatimResponse[] = await response.json();

    if (!data || data.length === 0) {
      // Fallback: try general search with just zip code
      return geocodeAddress(`${zipCode}, ${countryCode}`);
    }

    const result: GeocodingResult = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      placeType: data[0].type || "postcode",
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Geocode a city and state to lat/lng coordinates
 * @param city City name
 * @param state State code or name
 * @param countryCode Optional country code (default: "US")
 * @returns Geocoding result or null if not found
 */
export async function geocodeCityState(
  city: string,
  state: string,
  countryCode: string = "US"
): Promise<GeocodingResult | null> {
  return geocodeAddress(`${city}, ${state}, ${countryCode}`);
}

/**
 * Batch geocode multiple addresses (respects rate limiting)
 * @param addresses Array of addresses to geocode
 * @returns Array of results (null for failed lookups)
 */
export async function batchGeocode(addresses: string[]): Promise<(GeocodingResult | null)[]> {
  const results: (GeocodingResult | null)[] = [];

  for (const address of addresses) {
    const result = await geocodeAddress(address);
    results.push(result);
  }

  return results;
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  cacheTimestamps.clear();
}

/**
 * Get cache statistics
 */
export function getGeocacheCacheStats(): { size: number; maxSize: number } {
  return {
    size: geocodeCache.size,
    maxSize: 1000,
  };
}
