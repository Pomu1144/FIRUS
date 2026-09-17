/**
 * Command parser. Pure: takes the raw utterance, returns an intent object.
 * Keeping it free of DOM access is what lets it be unit-tested directly.
 */

import { resolveVisionMode } from "./ui/accessibility.js";

const RESET_WORDS = /^(reset|back|return|home|close|exit|clear|stop)\b/;
const FIELD_WORDS = /^(show|particles?|particle field|field|visuali[sz]e|expand)\b/;
const HELP_WORDS = /^(\?+$|help\b|commands?\b|what can (you|i) do)/;
const SETTINGS_WORDS = /\b(settings|accessibility|a11y|options|preferences)\b/;
const FOOD_WORDS = /\b(food ?banks?|food ?pantr(y|ies)|pantr(y|ies)|soup kitchens?)\b/;
const NEAR_ME = /\b(near me|nearest|closest|around me|by me|near by|nearby|my area)\b/;
const OPEN_NOW = /\b(open now|open today|currently open|open right now|that are open|whats open|what's open)\b/;
const TERRAIN = /\b(3d|terrain|topo|topographic|elevation)\b/;
const FLAT = /\b(2d|flat|black map|dark map|plain map)\b/;
const LOCATE = /\b(where am i|my location|locate me|find me)\b/;

const MAP_PREFIXES = [
  "show me a map of ",
  "show me map of ",
  "show map of ",
  "show a map of ",
  "open a map of ",
  "open map of ",
  "map of ",
  "map for ",
  "map to ",
  "map in ",
  "map near ",
  "map around ",
  "take me to ",
  "go to ",
  "navigate to ",
  "find "
];

const TEXT_SIZE = [
  [/\b(extra large|x-?large|biggest) text\b/, "x-large"],
  [/\b(large|larger|bigger|big) text\b/, "large"],
  [/\b(normal|default|regular|smaller) text\b/, "normal"]
];

const stripTrailingPunctuation = (value) => value.replace(/[.!?,;]+$/g, "").trim();

/** Pulls a place name out of a map-ish utterance; "" when there isn't one. */
export function extractMapLocation(raw) {
  const original = raw.trim();
  const text = original.toLowerCase();

  if (text.startsWith("where is ")) return stripTrailingPunctuation(original.slice(9));
  if (text.startsWith("where's ")) return stripTrailingPunctuation(original.slice(8));

  for (const prefix of MAP_PREFIXES) {
    if (text.startsWith(prefix)) return stripTrailingPunctuation(original.slice(prefix.length));
  }

  // "<place> map" / "map <place>" as a fallback, but only when "map" is present.
  if (!/\bmaps?\b/.test(text)) return "";
  const trailing = text.replace(/^.*\bmaps?\b/, "").trim();
  if (trailing) return stripTrailingPunctuation(original.slice(original.length - trailing.length));
  const leading = text.replace(/\bmaps?\b.*$/, "").trim();
  return leading ? stripTrailingPunctuation(original.slice(0, leading.length)) : "";
}

/** "food banks in Hamilton OH" -> "Hamilton OH". Ignores "near me". */
export function extractNearPlace(raw) {
  const original = raw.trim();
  const text = original.toLowerCase();
  const match = text.match(/\b(?:in|near|around|close to|closest to|by|within)\s+(.+)$/);
  if (!match) return "";
  let candidate = match[1];
  // Drop a leading radius phrase: "within 10 miles of Mason" -> "Mason".
  candidate = candidate.replace(/^\d+(?:\.\d+)?\s*(?:miles|mile|mi)\b\s*(?:of|from)?\s*/, "");
  candidate = stripTrailingPunctuation(candidate);
  if (!candidate || /^(me|here|my area|my location)$/.test(candidate)) return "";
  const start = text.lastIndexOf(candidate);
  return start === -1 ? candidate : stripTrailingPunctuation(original.slice(start, start + candidate.length));
}

function parseRadiusMiles(text) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/);
  if (!match) return null;
  const miles = Number(match[1]);
  return Number.isFinite(miles) && miles > 0 ? miles : null;
}

export function parseCommand(raw) {
  const original = String(raw ?? "").trim();
  const text = original.toLowerCase();
  if (!text) return { type: "empty" };

  if (HELP_WORDS.test(text)) return { type: "help" };

  // --- Accessibility -------------------------------------------------------
  if (/\b(high contrast|contrast)\b/.test(text) && !/\bmap\b/.test(text)) {
    if (/\b(off|disable|no|normal)\b/.test(text)) return { type: "contrast", value: "normal" };
    return { type: "contrast", value: "high" };
  }

  if (/\bmotion\b|\banimations?\b/.test(text)) {
    const off = /\b(reduce|reduced|less|stop|disable|off|no)\b/.test(text);
    return { type: "motion", value: off ? "reduced" : "full" };
  }

  for (const [pattern, value] of TEXT_SIZE) {
    if (pattern.test(text)) return { type: "textSize", value };
  }

  if (/\blabels?\b/.test(text)) {
    const off = /\b(off|hide|no|hover)\b/.test(text);
    return { type: "markerLabels", value: off ? "hover" : "always" };
  }

  const visionPhrase = text
    .replace(/\b(set|turn on|turn|enable|switch to|use|mode|palette|colou?r ?blind(ness)?|colou?r vision|vision)\b/g, " ")
    .trim();
  if (
    /(colou?r ?blind|colou?r vision|deuteran\w*|protan\w*|tritan\w*|achromat\w*|palette|monochrome|greyscale|grayscale)/.test(text)
  ) {
    const mode = resolveVisionMode(visionPhrase) ?? resolveVisionMode(text) ?? "universal";
    return { type: "vision", mode };
  }

  if (SETTINGS_WORDS.test(text)) return { type: "settings" };

  // --- Map controls --------------------------------------------------------
  if (TERRAIN.test(text) && !FOOD_WORDS.test(text)) return { type: "basemap", mode: "terrain" };
  if (FLAT.test(text) && !FOOD_WORDS.test(text)) return { type: "basemap", mode: "flat" };

  if (RESET_WORDS.test(text)) return { type: "reset" };
  if (LOCATE.test(text)) return { type: "locate" };

  // --- Data ----------------------------------------------------------------
  if (FOOD_WORDS.test(text)) {
    const explicitPlace = extractMapLocation(original) || extractNearPlace(original);
    return {
      type: "foodBanks",
      nearMe: NEAR_ME.test(text) || parseRadiusMiles(text) !== null,
      radiusMiles: parseRadiusMiles(text),
      openOnly: OPEN_NOW.test(text),
      near: FOOD_WORDS.test(explicitPlace.toLowerCase()) ? "" : explicitPlace
    };
  }

  const location = extractMapLocation(original);
  if (location) return { type: "map", query: location };

  if (FIELD_WORDS.test(text)) return { type: "field" };

  return { type: "unknown", text: original };
}

/** Rows for the in-app help sheet. */
export const COMMAND_HELP = [
  ["show", "Open the particle field"],
  ["map of Cincinnati", "Fly the map to any place"],
  ["where is Fairfield, OH", "Same, phrased as a question"],
  ["food banks near me", "Plot every food bank, nearest first"],
  ["food pantries within 10 miles", "Filter by distance from you"],
  ["food banks open now", "Only the ones open at this moment"],
  ["3d / 2d", "Switch between terrain and the black basemap"],
  ["where am i", "Find and mark your location"],
  ["colorblind mode", "Switch to the universal safe palette"],
  ["deuteranopia / protanopia / tritanopia", "Pick a specific colour-vision palette"],
  ["high contrast", "Raise contrast across the whole interface"],
  ["reduce motion", "Stop the ambient animation"],
  ["large text", "Increase the interface text size"],
  ["settings", "Open the accessibility panel"],
  ["reset", "Return to the core"],
  ["help", "Show this list"]
];
