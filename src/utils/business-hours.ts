// src/utils/business-hours.ts
// Business hours calculation utilities for Quick Responder badge

/**
 * Day schedule - open/close times and enabled flag
 */
interface DaySchedule {
  enabled: boolean;
  open: string; // "HH:mm" format, e.g. "09:00"
  close: string; // "HH:mm" format, e.g. "17:00"
}

/**
 * Weekly business hours schedule
 */
interface BusinessHoursSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

/**
 * System default business hours (Mon-Fri 9am-5pm)
 */
const DEFAULT_BUSINESS_HOURS: BusinessHoursSchedule = {
  monday: { enabled: true, open: "09:00", close: "17:00" },
  tuesday: { enabled: true, open: "09:00", close: "17:00" },
  wednesday: { enabled: true, open: "09:00", close: "17:00" },
  thursday: { enabled: true, open: "09:00", close: "17:00" },
  friday: { enabled: true, open: "09:00", close: "17:00" },
  saturday: { enabled: false, open: "09:00", close: "17:00" },
  sunday: { enabled: false, open: "09:00", close: "17:00" },
};

const DEFAULT_TIMEZONE = "America/New_York";

// Day name mapping (0 = Sunday in JS Date)
const DAY_NAMES: (keyof BusinessHoursSchedule)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Quick Responder badge threshold: 4 hours in seconds
const QUICK_RESPONDER_THRESHOLD_SECONDS = 4 * 60 * 60; // 14400 seconds

// Minimum number of responses required before badge can be evaluated
const QUICK_RESPONDER_MIN_RESPONSES = 5;

/**
 * Parse a time string (HH:mm) into hours and minutes
 */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

/**
 * Get a Date object in the specified timezone
 */
function getDateInTimezone(date: Date, timeZone: string): Date {
  // Get the date string in the target timezone
  const dateStr = date.toLocaleString("en-US", { timeZone });
  return new Date(dateStr);
}

/**
 * Check if a given time (in the tenant's timezone) falls within business hours
 */
function isWithinBusinessHours(
  date: Date,
  schedule: BusinessHoursSchedule,
  timeZone: string
): boolean {
  const localDate = getDateInTimezone(date, timeZone);
  const dayOfWeek = localDate.getDay();
  const daySchedule = schedule[DAY_NAMES[dayOfWeek]];

  if (!daySchedule.enabled) {
    return false;
  }

  const currentHours = localDate.getHours();
  const currentMinutes = localDate.getMinutes();
  const currentTimeMinutes = currentHours * 60 + currentMinutes;

  const openTime = parseTime(daySchedule.open);
  const closeTime = parseTime(daySchedule.close);
  const openMinutes = openTime.hours * 60 + openTime.minutes;
  const closeMinutes = closeTime.hours * 60 + closeTime.minutes;

  return currentTimeMinutes >= openMinutes && currentTimeMinutes < closeMinutes;
}

/**
 * Get the next business hours start time from a given date
 */
function getNextBusinessHoursStart(
  date: Date,
  schedule: BusinessHoursSchedule,
  timeZone: string
): Date {
  const localDate = getDateInTimezone(date, timeZone);
  let currentDay = localDate.getDay();
  let daysChecked = 0;

  // Check up to 7 days ahead to find the next business day
  while (daysChecked < 7) {
    const daySchedule = schedule[DAY_NAMES[currentDay]];

    if (daySchedule.enabled) {
      const openTime = parseTime(daySchedule.open);
      const nextStart = new Date(localDate);
      nextStart.setDate(nextStart.getDate() + daysChecked);
      nextStart.setHours(openTime.hours, openTime.minutes, 0, 0);

      // If we're on the same day and it's already past the open time,
      // check if we're still within business hours
      if (daysChecked === 0) {
        const closeTime = parseTime(daySchedule.close);
        const closeMinutes = closeTime.hours * 60 + closeTime.minutes;
        const currentMinutes = localDate.getHours() * 60 + localDate.getMinutes();

        // If current time is before open, return open time today
        const openMinutes = openTime.hours * 60 + openTime.minutes;
        if (currentMinutes < openMinutes) {
          return nextStart;
        }

        // If current time is within business hours, return current time
        if (currentMinutes < closeMinutes) {
          return date; // Already in business hours
        }

        // Past close time, continue to next day
      } else {
        // Found a business day in the future
        return nextStart;
      }
    }

    currentDay = (currentDay + 1) % 7;
    daysChecked++;
  }

  // Fallback: no business days configured, return the input date
  return date;
}

/**
 * Get the business hours end time for a given date
 */
function getBusinessHoursEnd(
  date: Date,
  schedule: BusinessHoursSchedule,
  timeZone: string
): Date | null {
  const localDate = getDateInTimezone(date, timeZone);
  const dayOfWeek = localDate.getDay();
  const daySchedule = schedule[DAY_NAMES[dayOfWeek]];

  if (!daySchedule.enabled) {
    return null;
  }

  const closeTime = parseTime(daySchedule.close);
  const endDate = new Date(localDate);
  endDate.setHours(closeTime.hours, closeTime.minutes, 0, 0);
  return endDate;
}

/**
 * Calculate the number of seconds that fall within business hours between two dates.
 * This is the key function for the Quick Responder badge calculation.
 *
 * @param startDate - When the inquiry was received
 * @param endDate - When the breeder responded
 * @param schedule - The breeder's business hours schedule (or default)
 * @param timeZone - The breeder's timezone (or default)
 * @returns Number of seconds within business hours between the two dates
 */
function calculateBusinessHoursSeconds(
  startDate: Date,
  endDate: Date,
  schedule: BusinessHoursSchedule | null,
  timeZone: string | null
): number {
  const effectiveSchedule = schedule ?? DEFAULT_BUSINESS_HOURS;
  const effectiveTimezone = timeZone ?? DEFAULT_TIMEZONE;

  // If end is before start, return 0
  if (endDate <= startDate) {
    return 0;
  }

  let totalSeconds = 0;
  let current = new Date(startDate);

  // Maximum iterations to prevent infinite loops (30 days worth of iterations)
  const maxIterations = 30 * 24; // 720 iterations max
  let iterations = 0;

  while (current < endDate && iterations < maxIterations) {
    iterations++;

    const localCurrent = getDateInTimezone(current, effectiveTimezone);
    const dayOfWeek = localCurrent.getDay();
    const daySchedule = effectiveSchedule[DAY_NAMES[dayOfWeek]];

    if (!daySchedule.enabled) {
      // Skip to start of next day
      const nextDay = new Date(localCurrent);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      current = nextDay;
      continue;
    }

    const openTime = parseTime(daySchedule.open);
    const closeTime = parseTime(daySchedule.close);

    const openMinutes = openTime.hours * 60 + openTime.minutes;
    const closeMinutes = closeTime.hours * 60 + closeTime.minutes;
    const currentMinutes = localCurrent.getHours() * 60 + localCurrent.getMinutes();

    if (currentMinutes < openMinutes) {
      // Before business hours - skip to open time
      const skipTo = new Date(localCurrent);
      skipTo.setHours(openTime.hours, openTime.minutes, 0, 0);
      current = skipTo;
      continue;
    }

    if (currentMinutes >= closeMinutes) {
      // After business hours - skip to next day
      const nextDay = new Date(localCurrent);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      current = nextDay;
      continue;
    }

    // We're within business hours
    const businessEndToday = new Date(localCurrent);
    businessEndToday.setHours(closeTime.hours, closeTime.minutes, 0, 0);

    // Calculate seconds until either endDate or business close (whichever is sooner)
    const effectiveEnd = endDate < businessEndToday ? endDate : businessEndToday;
    const secondsInPeriod = Math.floor((effectiveEnd.getTime() - current.getTime()) / 1000);

    if (secondsInPeriod > 0) {
      totalSeconds += secondsInPeriod;
    }

    // Move to next period
    if (endDate <= businessEndToday) {
      // We've reached the end
      break;
    } else {
      // Move to next day
      const nextDay = new Date(localCurrent);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      current = nextDay;
    }
  }

  return totalSeconds;
}

/**
 * Determine if a breeder qualifies for the Quick Responder badge.
 * Badge is earned when average response time is <= 4 hours (14400 seconds)
 * AND the breeder has responded to at least QUICK_RESPONDER_MIN_RESPONSES messages.
 * Badge is lost when average exceeds that threshold.
 *
 * @param avgResponseTimeSeconds - Average response time in business hours seconds
 * @param responseCount - Total number of responses tracked
 * @returns true if badge should be awarded, false if badge should be revoked
 */
function shouldHaveQuickResponderBadge(
  avgResponseTimeSeconds: number | null,
  responseCount: number
): boolean {
  // Must have minimum sample size before badge can be evaluated
  if (responseCount < QUICK_RESPONDER_MIN_RESPONSES) {
    return false;
  }
  if (avgResponseTimeSeconds === null) {
    return false;
  }
  return avgResponseTimeSeconds <= QUICK_RESPONDER_THRESHOLD_SECONDS;
}

/**
 * Calculate the new running average response time.
 * Uses incremental average formula: newAvg = oldAvg + (newValue - oldAvg) / newCount
 *
 * @param currentAvg - Current average (null if no prior responses)
 * @param currentCount - Number of responses in current average
 * @param newResponseTime - New response time to add
 * @returns New average and new count
 */
function updateRunningAverage(
  currentAvg: number | null,
  currentCount: number,
  newResponseTime: number
): { newAvg: number; newCount: number } {
  if (currentAvg === null || currentCount === 0) {
    return { newAvg: newResponseTime, newCount: 1 };
  }

  const newCount = currentCount + 1;
  const newAvg = currentAvg + (newResponseTime - currentAvg) / newCount;

  return { newAvg: Math.round(newAvg), newCount };
}

/**
 * Format seconds into a human-readable string
 */
function formatResponseTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_TIMEZONE,
  QUICK_RESPONDER_THRESHOLD_SECONDS,
  QUICK_RESPONDER_MIN_RESPONSES,
  calculateBusinessHoursSeconds,
  shouldHaveQuickResponderBadge,
  updateRunningAverage,
  isWithinBusinessHours,
  getNextBusinessHoursStart,
  getBusinessHoursEnd,
  formatResponseTime,
};

export type { BusinessHoursSchedule, DaySchedule };
