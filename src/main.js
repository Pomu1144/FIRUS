/**
 * FIRUS - application wiring.
 *
 * Owns the visual state machine (core -> zoom -> field/map -> reassemble ->
 * core), routes parsed commands, and keeps the accessible surface in sync:
 * a live region for every state change, focus management for the panels, and
 * a text list that mirrors whatever the map is showing.
 */

import { FOOD_BANKS, REGION_VIEW } from "./data/food-banks.js";
import { parseCommand } from "./commands.js";
import { formatDistance, requestUserLocation, withDistance } from "./lib/geo.js";
import { OPEN_STATUS, STATUS_LABEL, openStatus } from "./lib/hours.js";
import { geocode } from "./lib/geocode.js";
import { createAccessibility, VISION_MODES } from "./ui/accessibility.js";
import { createAnnouncer } from "./ui/announcer.js";
import { createHelpPanel } from "./ui/help-panel.js";
import { createSettingsPanel } from "./ui/settings-panel.js";
import { createMapPanel, ensureLeaflet } from "./ui/map.js";
import { createParticleField, createZoomLayer, reassembleField, removeLayer } from "./ui/field.js";

const ZOOM_PHASE_DURATION_MS = 2200;

const STATUS_COPY = {
  listening: "listening",
  responding: "responding",
  zoom: "expanding",
  field: "visualizing",
  map: "mapping",
  reassemble: "reassembling"
};

const dom = {
  app: document.getElementById("app"),
  voiceCore: document.getElementById("voiceCore"),
  coreShell: document.getElementById("coreShell"),
  reactivePulse: document.getElementById("reactivePulse"),
  statusLabel: document.getElementById("statusLabel"),
  commandInput: document.getElementById("commandInput"),
  sendButton: document.getElementById("sendButton"),
  voiceButton: document.getElementById("voiceButton"),
  settingsButton: document.getElementById("settingsButton"),
  helpButton: document.getElementById("helpButton"),
  toastStack: document.getElementById("toastStack"),
  liveRegion: document.getElementById("liveRegion"),
  panelHost: document.getElementById("panelHost"),
  panelBackdrop: document.getElementById("panelBackdrop")
};

const announcer = createAnnouncer({ stack: dom.toastStack, liveRegion: dom.liveRegion });
const accessibility = createAccessibility();

const state = {
  status: "listening",
  visualMode: "core",
  userLocation: null,
  locationRequested: false,
  mapPanel: null,
  openPanel: null,
  lastFocused: null,
  transitionToken: 0,
  transitionTimer: null,
  geocodeAbort: null,
  speechActive: false
};

/* ------------------------------------------------------------------ core UI */

function updateStatusLabel() {
  const key = state.visualMode === "core" ? state.status : state.visualMode;
  dom.statusLabel.textContent = STATUS_COPY[key] ?? STATUS_COPY.listening;
}

function setStatus(next) {
  state.status = next;
  dom.coreShell.classList.toggle("responding", next === "responding");
  dom.reactivePulse.hidden = !(next === "responding" && state.visualMode === "core");
  updateStatusLabel();
}

function setVisualMode(next) {
  state.visualMode = next;
  dom.app.classList.toggle("zooming", next === "zoom");
  dom.coreShell.classList.toggle("hidden-for-zoom", next === "zoom");
  dom.coreShell.classList.toggle("hidden-for-field", next === "field" || next === "map");
  dom.coreShell.classList.toggle("reassembling", next === "reassemble");
  dom.reactivePulse.hidden = !(state.status === "responding" && next === "core");
  updateStatusLabel();
}

function buildReactivePulse() {
  dom.reactivePulse.innerHTML = "";
  for (let i = 0; i < 2; i += 1) {
    const ring = document.createElement("div");
    ring.className = "reactive-ring";
    dom.reactivePulse.appendChild(ring);
  }
  const conic = document.createElement("div");
  conic.className = "reactive-conic";
  dom.reactivePulse.appendChild(conic);
}

/** Invalidates any in-flight transition so a second command cannot land late. */
function beginTransition() {
  state.transitionToken += 1;
  if (state.transitionTimer) {
    window.clearTimeout(state.transitionTimer);
    state.transitionTimer = null;
  }
  state.geocodeAbort?.abort();
  state.geocodeAbort = null;
  return state.transitionToken;
}

/* ---------------------------------------------------------------- panels */

function openPanel(panel, name) {
  if (state.openPanel === name) return closePanel();
  closePanel();
  state.lastFocused = document.activeElement;
  panel.element.hidden = false;
  dom.panelBackdrop.hidden = false;
  state.openPanel = name;
  const button = name === "settings" ? dom.settingsButton : dom.helpButton;
  button?.setAttribute("aria-expanded", "true");
  panel.focusFirst();
}

function closePanel() {
  if (!state.openPanel) return;
  settingsPanel.element.hidden = true;
  helpPanel.element.hidden = true;
  dom.panelBackdrop.hidden = true;
  dom.settingsButton.setAttribute("aria-expanded", "false");
  dom.helpButton.setAttribute("aria-expanded", "false");
  state.openPanel = null;
  if (state.lastFocused?.isConnected) state.lastFocused.focus();
  state.lastFocused = null;
}

/* ------------------------------------------------------------------ location */

async function ensureUserLocation({ prompt = true } = {}) {
  if (state.userLocation) return state.userLocation;
  if (!prompt) return null;

  announcer.info("Asking your browser for your location…", { timeout: 3500 });
  const result = await requestUserLocation();
  state.locationRequested = true;

  if (!result.ok) {
    const message =
      result.reason === "denied"
        ? "Location permission was denied, so results are not sorted by distance. Name a place instead, e.g. “food banks in Hamilton OH”."
        : "Your location is not available right now, so results are not sorted by distance.";
    announcer.warn(message, { timeout: 9000 });
    return null;
  }

  state.userLocation = result.location;
  state.mapPanel?.setUserLocation(result.location);
  return result.location;
}

/* ---------------------------------------------------------------------- map */

async function openMapPanel({ title, places = [], center, zoom, fit }) {
  let L;
  try {
    L = await ensureLeaflet();
  } catch (error) {
    announcer.error(
      "The map library could not be loaded (check your connection). Results are listed below instead."
    );
    return null;
  }

  const panel = createMapPanel({
    mount: dom.app,
    L,
    accessibility,
    announcer,
    view: center ? { lat: center.lat, lon: center.lon, zoom: zoom ?? 12 } : REGION_VIEW,
    onClose: () => returnToCore()
  });

  state.mapPanel = panel;
  panel.setTitle(title);
  if (state.userLocation) panel.setUserLocation(state.userLocation);
  if (places.length) panel.setPlaces(places, { fit: fit !== false });
  return panel;
}

/** Runs the zoom transition, then whatever should exist on the other side. */
function runZoomTransition(token, land) {
  setStatus("responding");
  setVisualMode("zoom");

  const reduced = accessibility.prefersReducedMotion();
  createZoomLayer({ reducedMotion: reduced });
  const duration = reduced ? 220 : ZOOM_PHASE_DURATION_MS;

  return new Promise((resolve) => {
    state.transitionTimer = window.setTimeout(async () => {
      state.transitionTimer = null;
      if (token !== state.transitionToken) {
        resolve(false);
        return;
      }
      removeLayer(".zoom-layer");
      await land();
      resolve(true);
    }, duration);
  });
}

async function showMapFor(query) {
  const token = beginTransition();
  setStatus("responding");
  announcer.announce(`Looking up ${query}.`);

  const controller = new AbortController();
  state.geocodeAbort = controller;
  const result = await geocode(query, { signal: controller.signal });
  if (token !== state.transitionToken) return;

  if (!result.ok) {
    setStatus("listening");
    if (result.reason === "empty") {
      announcer.error(`No place matched “${query}”. Try adding a state, e.g. “map of Mason, OH”.`);
    } else if (result.reason === "network") {
      announcer.error("The place lookup service could not be reached. Check your connection and try again.");
    }
    return;
  }

  const { place } = result;

  if (state.mapPanel) {
    state.mapPanel.setTitle(query);
    state.mapPanel.setPlaces([], { fit: false });
    state.mapPanel.hopTo(place.lat, place.lon, 13);
    announcer.success(`Map moved to ${place.label}.`);
    setStatus("listening");
    return;
  }

  await runZoomTransition(token, async () => {
    const panel = await openMapPanel({
      title: query,
      center: { lat: place.lat, lon: place.lon },
      zoom: 13
    });
    setVisualMode(panel ? "map" : "core");
    setStatus("listening");
    if (panel) announcer.success(`Map open at ${place.label}.`);
  });
}

function describeFoodBankResult(places, { radiusMiles, openOnly, originLabel }) {
  if (!places.length) {
    const limits = [
      radiusMiles ? `within ${radiusMiles} miles` : null,
      openOnly ? "open right now" : null
    ].filter(Boolean);
    return `No food banks ${limits.length ? limits.join(" and ") : "found"}${
      originLabel ? ` of ${originLabel}` : ""
    }. Try a wider radius.`;
  }
  const nearest = places[0];
  const distance = formatDistance(nearest.distanceMiles);
  return `${places.length} location${places.length === 1 ? "" : "s"} plotted. Nearest: ${nearest.name}${
    distance ? `, ${distance} away` : ""
  }, ${STATUS_LABEL[openStatus(nearest)]}.`;
}

async function showFoodBanks(intent) {
  const token = beginTransition();
  setStatus("responding");

  let origin = state.userLocation;
  let originLabel = "you";

  if (intent.near) {
    const controller = new AbortController();
    state.geocodeAbort = controller;
    const result = await geocode(intent.near, { signal: controller.signal });
    if (token !== state.transitionToken) return;
    if (result.ok) {
      origin = { lat: result.place.lat, lon: result.place.lon };
      originLabel = intent.near;
    } else {
      announcer.warn(`Could not find “${intent.near}”, showing the whole region instead.`);
    }
  } else if (intent.nearMe || intent.radiusMiles) {
    origin = await ensureUserLocation();
    if (token !== state.transitionToken) return;
  }

  let places = withDistance(FOOD_BANKS, origin);

  if (intent.radiusMiles && origin) {
    places = places.filter((place) => place.distanceMiles <= intent.radiusMiles);
  } else if (intent.radiusMiles && !origin) {
    announcer.warn(
      `Without a location the ${intent.radiusMiles}-mile filter cannot be applied, so every location is shown.`
    );
  }

  if (intent.openOnly) {
    places = places.filter((place) => openStatus(place) === OPEN_STATUS.OPEN);
  }

  const title = intent.openOnly ? "Food banks open now" : "Food banks";
  const summary = describeFoodBankResult(places, { ...intent, originLabel });

  if (state.mapPanel) {
    state.mapPanel.setTitle(title);
    state.mapPanel.setPlaces(places);
    announcer.success(summary);
    setStatus("listening");
    return;
  }

  await runZoomTransition(token, async () => {
    const panel = await openMapPanel({ title, places });
    setVisualMode(panel ? "map" : "core");
    setStatus("listening");
    announcer[places.length ? "success" : "warn"](summary);
  });
}

/* -------------------------------------------------------------- field / reset */

async function showParticleField() {
  const token = beginTransition();
  if (state.visualMode === "field") {
    announcer.info("The particle field is already open. Say “reset” to return to the core.");
    return;
  }
  teardownMap();

  await runZoomTransition(token, async () => {
    createParticleField(dom.voiceCore);
    setVisualMode("field");
    setStatus("listening");
    announcer.success("Particle field open. Say “reset” to return to the core.");
  });
}

function teardownMap() {
  state.mapPanel?.destroy();
  state.mapPanel = null;
}

async function returnToCore({ silent = false } = {}) {
  const token = beginTransition();
  const wasElsewhere = state.visualMode !== "core";
  teardownMap();
  removeLayer(".zoom-layer");

  if (wasElsewhere) {
    setVisualMode("reassemble");
    await reassembleField(dom.voiceCore, { reducedMotion: accessibility.prefersReducedMotion() });
  } else {
    removeLayer(".particle-field");
  }

  if (token !== state.transitionToken) return;
  setVisualMode("core");
  setStatus("listening");
  if (wasElsewhere && !silent) announcer.info("Back at the core.");
}

/* ------------------------------------------------------------------ commands */

async function handleIntent(intent) {
  switch (intent.type) {
    case "empty":
      return;

    case "help":
      openPanel(helpPanel, "help");
      announcer.announce("Command list open.");
      return;

    case "settings":
      openPanel(settingsPanel, "settings");
      announcer.announce("Accessibility settings open.");
      return;

    case "vision": {
      accessibility.set({ vision: intent.mode });
      const mode = VISION_MODES.find((candidate) => candidate.id === intent.mode);
      announcer.success(`Colour vision mode: ${mode?.name ?? intent.mode}. ${mode?.note ?? ""}`);
      return;
    }

    case "contrast":
      accessibility.set({ contrast: intent.value });
      announcer.success(intent.value === "high" ? "High contrast on." : "High contrast off.");
      return;

    case "motion":
      accessibility.set({ motion: intent.value });
      announcer.success(intent.value === "reduced" ? "Motion reduced." : "Full motion restored.");
      return;

    case "textSize":
      accessibility.set({ textSize: intent.value });
      announcer.success(`Text size: ${intent.value.replace("-", " ")}.`);
      return;

    case "markerLabels":
      accessibility.set({ markerLabels: intent.value });
      announcer.success(intent.value === "always" ? "Map pin labels are always shown." : "Map pin labels hidden.");
      return;

    case "basemap": {
      if (!state.mapPanel) {
        announcer.warn("There is no map open yet. Try “food banks near me” first.");
        return;
      }
      const mode = state.mapPanel.setBasemap(intent.mode);
      announcer.success(mode === "terrain" ? "Switched to 3D terrain tiles." : "Switched to the black basemap.");
      return;
    }

    case "locate": {
      const location = await ensureUserLocation();
      if (!location) return;
      announcer.success(
        `Location found: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}.`
      );
      if (state.mapPanel) {
        state.mapPanel.setUserLocation(location);
        state.mapPanel.flyTo(location.lat, location.lon, 13);
      }
      return;
    }

    case "reset":
      await returnToCore();
      return;

    case "field":
      await showParticleField();
      return;

    case "map":
      await showMapFor(intent.query);
      return;

    case "foodBanks":
      await showFoodBanks(intent);
      return;

    default:
      announcer.warn(
        `“${intent.text}” is not a command yet. Press ? or say “help” for the full list.`
      );
  }
}

async function runCommand(raw = dom.commandInput.value) {
  const intent = parseCommand(raw);
  if (intent.type !== "empty") dom.commandInput.value = "";
  try {
    await handleIntent(intent);
  } catch (error) {
    console.error("[firus] command failed", error);
    announcer.error("Something went wrong running that command. Try again.");
    setStatus("listening");
  }
}

/* -------------------------------------------------------------------- speech */

function speechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startVoiceCommand() {
  const SpeechRecognition = speechRecognitionConstructor();
  if (!SpeechRecognition || state.speechActive) return;

  const recognition = new SpeechRecognition();
  recognition.lang = document.documentElement.lang || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const finish = () => {
    state.speechActive = false;
    dom.voiceButton.textContent = "voice";
    dom.voiceButton.dataset.recording = "false";
    dom.voiceButton.setAttribute("aria-pressed", "false");
  };

  recognition.onstart = () => {
    state.speechActive = true;
    dom.voiceButton.textContent = "listening";
    dom.voiceButton.dataset.recording = "true";
    dom.voiceButton.setAttribute("aria-pressed", "true");
    announcer.info("Listening… speak your command.", { timeout: 3000 });
  };
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    if (!transcript) return;
    announcer.announce(`Heard: ${transcript}`);
    runCommand(transcript);
  };
  recognition.onerror = (event) => {
    finish();
    const message =
      event?.error === "not-allowed"
        ? "Microphone permission was denied. You can still type commands."
        : "Voice input did not catch that. Try again, or type the command.";
    announcer.warn(message);
  };
  recognition.onend = finish;

  try {
    recognition.start();
  } catch {
    finish();
  }
}

/* ---------------------------------------------------------------------- boot */

const settingsPanel = createSettingsPanel({
  mount: dom.panelHost,
  accessibility,
  onClose: () => closePanel()
});
const helpPanel = createHelpPanel({ mount: dom.panelHost, onClose: () => closePanel() });

function bindEvents() {
  dom.sendButton.addEventListener("click", () => runCommand());
  dom.voiceButton.addEventListener("click", startVoiceCommand);
  dom.settingsButton.addEventListener("click", () => openPanel(settingsPanel, "settings"));
  dom.helpButton.addEventListener("click", () => openPanel(helpPanel, "help"));
  dom.panelBackdrop.addEventListener("click", () => closePanel());

  dom.commandInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runCommand();
  });

  // Clicking empty space toggles the core between listening and responding -
  // but only empty space, never a control, a panel or the map.
  dom.app.addEventListener("click", (event) => {
    if (state.visualMode !== "core") return;
    if (event.target.closest("[data-interactive], input, button, a, .panel, .map-panel")) return;
    setStatus(state.status === "responding" ? "listening" : "responding");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.openPanel) {
        closePanel();
        return;
      }
      if (state.visualMode !== "core") returnToCore();
      return;
    }

    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;

    if (event.key === "/") {
      event.preventDefault();
      dom.commandInput.focus();
    } else if (event.key === "?") {
      event.preventDefault();
      openPanel(helpPanel, "help");
    }
  });
}

function boot() {
  buildReactivePulse();
  setStatus("listening");
  setVisualMode("core");

  if (!speechRecognitionConstructor()) {
    dom.voiceButton.disabled = true;
    dom.voiceButton.title = "Speech recognition is not supported in this browser.";
  }

  bindEvents();

  announcer.announce(
    "FIRUS ready. Type a command, or press question mark for the command list."
  );
}

boot();

// Exposed for the end-to-end tests (and handy in the console).
window.firus = {
  runCommand,
  parseCommand,
  accessibility,
  state,
  get mapPanel() {
    return state.mapPanel;
  }
};
