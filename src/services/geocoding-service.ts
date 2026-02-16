// src/services/geocoding-service.ts
// Geocoding service for converting addresses/zip codes to lat/lng coordinates
//
// Uses OpenStreetMap Nominatim API (free, no API key required)
// Rate limit: 1 request per second (enforced by simple delay)
//
// Cache strategy:
// - Redis when REDIS_URL is set (shared across instances)
// - In-memory fallback for local development
//
// Usage:
//   const coords = await geocodeAddress("Austin, TX");
//   const coords = await geocodeZipCode("78701");
//   const coords = await geocodeZipCode("78701", "US");

import { Redis } from "ioredis";

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

// ---------- Redis Cache (when available) ----------
const REDIS_URL = process.env.REDIS_URL;
const CACHE_PREFIX = "geocode:";
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    redisClient.on("error", (err: Error) => {
      console.error("[Geocoding] Redis error:", err.message);
    });
  }
  return redisClient;
}

// ---------- In-Memory Cache (fallback) ----------
const inMemoryCache = new Map<string, GeocodingResult>();
const inMemoryCacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const MAX_MEMORY_CACHE_SIZE = 1000;

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

// ---------- Unified Cache Interface ----------

async function getCached(key: string): Promise<GeocodingResult | null> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(CACHE_PREFIX + key);
      if (cached) {
        return JSON.parse(cached) as GeocodingResult;
      }
      return null;
    } catch (err) {
      console.error("[Geocoding] Redis get error:", err);
      // Fall through to in-memory
    }
  }

  // Fallback to in-memory
  const cached = inMemoryCache.get(key);
  const timestamp = inMemoryCacheTimestamps.get(key);

  if (cached && timestamp && (Date.now() - timestamp) < CACHE_TTL_MS) {
    return cached;
  }

  // Expired or not found
  inMemoryCache.delete(key);
  inMemoryCacheTimestamps.delete(key);
  return null;
}

async function setCache(key: string, result: GeocodingResult): Promise<void> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      await redis.setex(CACHE_PREFIX + key, CACHE_TTL_SECONDS, JSON.stringify(result));
      return;
    } catch (err) {
      console.error("[Geocoding] Redis set error:", err);
      // Fall through to in-memory
    }
  }

  // Fallback to in-memory
  inMemoryCache.set(key, result);
  inMemoryCacheTimestamps.set(key, Date.now());

  // Simple cache size limit
  if (inMemoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const firstKey = inMemoryCache.keys().next().value;
    if (firstKey) {
      inMemoryCache.delete(firstKey);
      inMemoryCacheTimestamps.delete(firstKey);
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
  const cached = await getCached(cacheKey);
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

    await setCache(cacheKey, result);
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
  const cached = await getCached(cacheKey);
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

    await setCache(cacheKey, result);
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
 * Note: Only clears in-memory cache. Redis keys expire via TTL.
 */
export async function clearGeocodeCache(): Promise<void> {
  // Clear in-memory
  inMemoryCache.clear();
  inMemoryCacheTimestamps.clear();

  // Clear Redis (scan for geocode: keys and delete)
  const redis = getRedisClient();
  if (redis) {
    try {
      const keys = await redis.keys(CACHE_PREFIX + "*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.error("[Geocoding] Redis clear error:", err);
    }
  }
}

/**
 * Get cache statistics
 */
export async function getGeocacheCacheStats(): Promise<{
  memorySize: number;
  maxMemorySize: number;
  redisConnected: boolean;
  redisKeyCount?: number;
}> {
  const redis = getRedisClient();
  let redisKeyCount: number | undefined;

  if (redis) {
    try {
      const keys = await redis.keys(CACHE_PREFIX + "*");
      redisKeyCount = keys.length;
    } catch {
      // Ignore errors
    }
  }

  return {
    memorySize: inMemoryCache.size,
    maxMemorySize: MAX_MEMORY_CACHE_SIZE,
    redisConnected: redis !== null,
    redisKeyCount,
  };
}
