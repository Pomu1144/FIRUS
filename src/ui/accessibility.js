/**
 * Accessibility preferences: colour-vision palettes, contrast, motion, text
 * size and permanent marker labels.
 *
 * The preferences are applied as data-attributes on <html>; CSS does the rest
 * (see css/tokens.css). Everything persists to localStorage, and every choice
 * is reachable from the keyboard and by typed/spoken command.
 */

import { readJSON, writeJSON } from "../lib/storage.js";

const STORAGE_KEY = "firus:a11y:v1";

export const DEFAULT_PREFERENCES = {
  vision: "default",
  contrast: "normal",
  motion: "system",
  textSize: "normal",
  markerLabels: "hover"
};

export const VISION_MODES = [
  {
    id: "default",
    name: "Monochrome (default)",
    note: "The original black-and-white FIRUS look. Status is shown by shape and text.",
    aliases: ["default", "mono", "original", "off", "none"]
  },
  {
    id: "universal",
    name: "Universal (Okabe-Ito)",
    note: "One palette that stays distinct for every common type of colour blindness.",
    aliases: ["universal", "okabe", "colorblind", "colourblind", "cvd", "safe"]
  },
  {
    id: "deuteranopia",
    name: "Deuteranopia",
    note: "Green-blind. Uses a blue / orange axis and drops green-red pairings.",
    aliases: ["deuteranopia", "deuteranomaly", "green", "green blind", "deutan"]
  },
  {
    id: "protanopia",
    name: "Protanopia",
    note: "Red-blind. Avoids red entirely and separates by blue against yellow.",
    aliases: ["protanopia", "protanomaly", "red", "red blind", "protan"]
  },
  {
    id: "tritanopia",
    name: "Tritanopia",
    note: "Blue-blind. Swaps to a teal / vermilion axis instead of blue-yellow.",
    aliases: ["tritanopia", "tritanomaly", "blue", "blue blind", "tritan"]
  },
  {
    id: "monochrome",
    name: "Achromatopsia",
    note: "No colour perception. Separates everything by brightness, shape and label.",
    aliases: ["achromatopsia", "achromatic", "grayscale", "greyscale", "no colour", "no color"]
  }
];

const VISION_IDS = new Set(VISION_MODES.map((mode) => mode.id));

/** Maps a free-text phrase ("green blind", "deutan") onto a mode id. */
export function resolveVisionMode(text) {
  const needle = String(text || "").trim().toLowerCase();
  if (!needle) return null;
  if (VISION_IDS.has(needle)) return needle;
  for (const mode of VISION_MODES) {
    if (mode.aliases.some((alias) => needle === alias || needle.includes(alias))) return mode.id;
  }
  return null;
}

export function createAccessibility({ onChange } = {}) {
  let preferences = readJSON(STORAGE_KEY, DEFAULT_PREFERENCES);
  const listeners = new Set();
  if (onChange) listeners.add(onChange);

  function apply() {
    const root = document.documentElement;
    root.dataset.vision = preferences.vision;
    root.dataset.contrast = preferences.contrast;
    root.dataset.motion = preferences.motion;
    root.dataset.textSize = preferences.textSize;
    root.dataset.markerLabels = preferences.markerLabels;
    for (const listener of listeners) listener(preferences);
  }

  apply();

  return {
    get() {
      return { ...preferences };
    },
    set(patch) {
      preferences = { ...preferences, ...patch };
      writeJSON(STORAGE_KEY, preferences);
      apply();
      return { ...preferences };
    },
    reset() {
      return this.set(DEFAULT_PREFERENCES);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...preferences });
      return () => listeners.delete(listener);
    },
    /**
     * True when animation should be skipped: either the in-app toggle is on, or
     * the OS asks for reduced motion and the user has not overridden it.
     */
    prefersReducedMotion() {
      if (preferences.motion === "reduced") return true;
      if (preferences.motion === "full") return false;
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    },
    /** Resolved palette colours, read back from CSS so there is one source of truth. */
    palette() {
      const styles = getComputedStyle(document.documentElement);
      const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
      return {
        accent: read("--accent", "#ffffff"),
        open: read("--status-open", "#ffffff"),
        closed: read("--status-closed", "#8a8a8a"),
        appointment: read("--status-appointment", "#c7c7c7"),
        unknown: read("--status-unknown", "#5f5f5f"),
        user: read("--status-user", "#ffffff"),
        ink: read("--marker-ink", "#000000")
      };
    }
  };
}
