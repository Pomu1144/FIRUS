/**
 * Map marker artwork.
 *
 * Each status gets its own SHAPE as well as its own colour, so the map is
 * still readable with no colour perception at all (and in a screenshot printed
 * in greyscale). The shapes are: filled circle = open, triangle = closed,
 * diamond = by appointment, square = hours unknown, crosshair = you.
 */

import { OPEN_STATUS } from "../lib/hours.js";

export const MARKER_GLYPH = {
  [OPEN_STATUS.OPEN]: "●",
  [OPEN_STATUS.CLOSED]: "▲",
  [OPEN_STATUS.APPOINTMENT]: "◆",
  [OPEN_STATUS.UNKNOWN]: "■"
};

const SIZE = 20;

function shapePath(status, color) {
  const stroke = `stroke="${color}" stroke-width="2.5" fill="none"`;
  switch (status) {
    case OPEN_STATUS.OPEN:
      // Solid disc with a dark core: reads as "filled" at any zoom.
      return `<circle cx="10" cy="10" r="7.5" fill="${color}" stroke="#000" stroke-width="1.5" />
              <circle cx="10" cy="10" r="2.6" fill="#000" />`;
    case OPEN_STATUS.CLOSED:
      return `<path d="M10 2.2 L18.2 16.8 L1.8 16.8 Z" fill="${color}" stroke="#000" stroke-width="1.4" />`;
    case OPEN_STATUS.APPOINTMENT:
      return `<path d="M10 1.8 L18.2 10 L10 18.2 L1.8 10 Z" fill="${color}" stroke="#000" stroke-width="1.4" />`;
    default:
      return `<rect x="3" y="3" width="14" height="14" rx="1.5" ${stroke} />`;
  }
}

/** Marker markup for a food bank. `label` is printed when labels are pinned on. */
export function placeMarkerHTML({ status, color, label }) {
  const safeLabel = String(label ?? "").replace(/[<>&]/g, "");
  return `<span class="marker-icon">
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      ${shapePath(status, color)}
    </svg>
    <span class="marker-label">${safeLabel}</span>
  </span>`;
}

/** "You are here": a crosshair, which no food bank shape can be confused with. */
export function userMarkerHTML(color) {
  return `<span class="marker-icon">
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <circle cx="13" cy="13" r="9" fill="none" stroke="#000" stroke-width="4" />
      <circle cx="13" cy="13" r="9" fill="none" stroke="${color}" stroke-width="2" />
      <circle cx="13" cy="13" r="2.6" fill="${color}" stroke="#000" stroke-width="1" />
      <path d="M13 0.5 V5 M13 21 V25.5 M0.5 13 H5 M21 13 H25.5"
            stroke="${color}" stroke-width="2" stroke-linecap="round" />
    </svg>
    <span class="marker-label">Your location</span>
  </span>`;
}

export function clusterMarkerHTML(count) {
  const size = count >= 100 ? 44 : count >= 20 ? 38 : 32;
  return {
    size,
    html: `<span class="cluster-icon" style="width:${size}px;height:${size}px">${count}</span>`
  };
}
