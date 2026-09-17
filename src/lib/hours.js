/** "Open now" computation against structured opening hours. */

import { HOURS_TIMEZONE } from "../data/food-banks.js";

export const OPEN_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
  APPOINTMENT: "appointment",
  UNKNOWN: "unknown"
};

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Reads wall-clock time in the dataset's timezone rather than the viewer's, so
 * a user in another timezone still sees the pantry's own local hours.
 */
export function localTimeParts(now = new Date(), timeZone = HOURS_TIMEZONE) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(now);
  } catch {
    // Unknown timezone (very old engine): fall back to the viewer's clock.
    return {
      day: now.getDay(),
      minutes: now.getHours() * 60 + now.getMinutes(),
      dayOfMonth: now.getDate()
    };
  }

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    day: DAY_INDEX[get("weekday")] ?? now.getDay(),
    minutes: hour * 60 + Number(get("minute")),
    dayOfMonth: Number(get("day")) || now.getDate()
  };
}

const toMinutes = (value) => {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
};

/** Which occurrence of its weekday a date is: the 3rd Tuesday -> 3. */
const weekOfMonth = (dayOfMonth) => Math.floor((dayOfMonth - 1) / 7) + 1;

export function openStatus(place, now = new Date()) {
  if (place.hours === null) return OPEN_STATUS.UNKNOWN;
  if (!place.hours.length) {
    return place.kind === "appointment" ? OPEN_STATUS.APPOINTMENT : OPEN_STATUS.UNKNOWN;
  }

  const { day, minutes, dayOfMonth } = localTimeParts(now);
  const week = weekOfMonth(dayOfMonth);

  const isOpen = place.hours.some((slot) => {
    if (!slot.days.includes(day)) return false;
    if (slot.weeks && !slot.weeks.includes(week)) return false;
    return minutes >= toMinutes(slot.open) && minutes < toMinutes(slot.close);
  });

  return isOpen ? OPEN_STATUS.OPEN : OPEN_STATUS.CLOSED;
}

export const STATUS_LABEL = {
  [OPEN_STATUS.OPEN]: "Open now",
  [OPEN_STATUS.CLOSED]: "Closed now",
  [OPEN_STATUS.APPOINTMENT]: "By appointment",
  [OPEN_STATUS.UNKNOWN]: "Hours unknown"
};
