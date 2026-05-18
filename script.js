const PARTICLE_COUNTS = { streaks: 82, field: 125, reassemble: 72, ticks: 24 };
const ZOOM_PHASE_DURATION_MS = 2200;
const statusCopy = { listening: "listening", responding: "responding", zoom: "expanding", field: "visualizing", reassemble: "reassembling" };

const app = document.getElementById("app");
const voiceCore = document.getElementById("voiceCore");
const coreShell = document.getElementById("coreShell");
const reactivePulse = document.getElementById("reactivePulse");
const statusLabel = document.getElementById("statusLabel");
const commandInput = document.getElementById("commandInput");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");

let status = "listening";
let visualMode = "core";
let transitionTimer = null;
let isListeningForSpeech = false;
let leafletReady = null;
let mapController = null;
let currentUserLocation = null;

const FOOD_BANK_LOCATIONS = [
  { name: "Shared Harvest Foodbank", address: "5901 Dixie Highway, Fairfield, OH 45014-4207", phone: "800-352-3663", hours: "Regional food bank contact." },
  { name: "Freestore Foodbank", address: "112 E Liberty St, Cincinnati, OH 45202", phone: "513-482-4500", hours: "Not listed in source." },
  { name: "Mid-Ohio Food Collective", address: "3960 Brookham Dr, Grove City, OH 43123", phone: "614-274-7770", hours: "Not listed in source." },
  { name: "The Foodbank, Inc.", address: "5650 Webster St, Dayton, OH 45414", phone: "937-461-5300", hours: "Not listed in source." },
  { name: "Fairfield Food Pantry", address: "78 Donald Drive, Fairfield, OH 45014", phone: "513-829-9047", hours: "Mon noon-3 pm; Wed noon-3 pm; Fri noon-3 pm." },
  { name: "Hamilton Dream Center", address: "725 Campbell Ave, Hamilton, OH 45011", phone: "513-893-2800", hours: "Fri 3 pm-5 pm; 2nd and 3rd Sat 10 am-2 pm." },
  { name: "Lighthouse Food Pantry", address: "626 Ridgelawn Ave, Hamilton, OH 45013", phone: "513-867-9463", hours: "Tue 5 pm-7 pm; Sat 9:30 am-12:30 pm." },
  { name: "Faith Community United Methodist", address: "8230 Cox Rd, West Chester, OH 45069", phone: "513-777-9533", hours: "Tue 1 pm-2:30 pm and 6:30 pm-8 pm; Sat 10 am-11:30 am." },
  { name: "Lebanon Food Pantry", address: "190 New Street, Lebanon, OH 45036", phone: "513-932-3617", hours: "Mon/Wed/Fri 9 am-noon; Wed 6 pm-8 pm." },
  { name: "Mason Food Pantry", address: "406 Fourth Avenue, Mason, OH 45040", phone: "513-754-0333", hours: "Mon 6:30 pm-7:30 pm; Wed 9:30 am-11 am; Sat 9:30 am-11 am." },
  { name: "Amelia United Methodist Church", address: "19 E Main St, Amelia, OH 45102", phone: "513-753-6770", hours: "Mon and Wed 11 am-1 pm." },
  { name: "Inter Parish Ministry", address: "4623 Aicholtz Rd, Cincinnati, OH 45244", phone: "513-561-3932", hours: "Mon/Tue/Thu/Fri 10 am-noon." },
  { name: "SEM", address: "2020 Beechmont Ave, Cincinnati, OH 45230", phone: "513-231-1412", hours: "By appointment." }
];

function clearTransitionTimer() { if (transitionTimer !== null) { window.clearTimeout(transitionTimer); transitionTimer = null; } }
function updateLabel() { statusLabel.textContent = visualMode === "core" ? statusCopy[status] : statusCopy[visualMode]; }
function setStatus(nextStatus) { status = nextStatus; coreShell.classList.toggle("responding", status === "responding"); reactivePulse.hidden = !(status === "responding" && visualMode === "core"); updateLabel(); }
function setVisualMode(nextMode) { visualMode = nextMode; app.classList.toggle("zooming", visualMode === "zoom"); coreShell.classList.toggle("hidden-for-zoom", visualMode === "zoom"); coreShell.classList.toggle("hidden-for-field", visualMode === "field"); coreShell.classList.toggle("reassembling", visualMode === "reassemble"); reactivePulse.hidden = !(status === "responding" && visualMode === "core"); updateLabel(); }
function toggleVoiceState(event) { if (event.target.closest("[data-command-ui='true'], input, button")) return; if (visualMode !== "core") return; setStatus(status === "responding" ? "listening" : "responding"); }
function removeLayer(selector) { document.querySelectorAll(selector).forEach((node) => node.remove()); }

function createReactivePulse() { reactivePulse.innerHTML = ""; for (let i = 0; i < 2; i += 1) { const ring = document.createElement("div"); ring.className = "reactive-ring"; reactivePulse.appendChild(ring);} const conic = document.createElement("div"); conic.className = "reactive-conic"; reactivePulse.appendChild(conic); }
function createZoomLayer() { removeLayer(".zoom-layer"); const layer = document.createElement("div"); layer.className = "zoom-layer"; layer.innerHTML = '<div class="zoom-flash"></div><div class="zoom-ring"></div><div class="zoom-core-burst"></div><div class="zoom-vignette"></div>'; for (let i=0;i<4;i++){const d=document.createElement("div"); d.className="zoom-depth-ring"; d.style.animationDelay=`${i*0.09}s`; d.style.setProperty("--ring-opacity",`${0.28-i*0.045}`); d.style.setProperty("--ring-scale",`${2.4+i*0.62}`); layer.appendChild(d);} document.body.appendChild(layer); }

function getSpeechRecognitionConstructor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

function extractMapLocation(command) {
  const text = command.trim().toLowerCase(); const original = command.trim();
  if (text.startsWith("where is ")) return original.slice(9).replace(/[.!?]+$/g, "").trim();
  if (!text.includes("map")) return "";
  const prefixes = ["show me a map of ","show me map of ","show map of ","show a map of ","open a map of ","open map of ","map of ","map for ","map to ","map in ","map near ","map around "];
  for (const prefix of prefixes) if (text.startsWith(prefix)) return original.slice(prefix.length).replace(/[.!?]+$/g, "").trim();
  return "";
}

function ensureLeaflet() { if (leafletReady) return leafletReady; leafletReady = new Promise((resolve, reject) => { if (window.L) return resolve(window.L); const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css); const js = document.createElement("script"); js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; js.onload = () => resolve(window.L); js.onerror = reject; document.body.appendChild(js);}); return leafletReady; }
async function geocodeAddress(query) { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`); const data = await res.json(); if (!data?.length) return null; return { lat: Number(data[0].lat), lon: Number(data[0].lon) }; }
function milesBetween(lat1, lon1, lat2, lon2) { const R = 3958.8; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180; const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }

function setMapMode(is3D) { if (!mapController?.map || !window.L) return; if (mapController.activeLayer) mapController.map.removeLayer(mapController.activeLayer); const url = is3D ? "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"; const opts = is3D ? { maxZoom: 17 } : { subdomains: "abcd", maxZoom: 19 }; mapController.activeLayer = window.L.tileLayer(url, opts).addTo(mapController.map); mapController.is3D = is3D; document.querySelector(".map-status").textContent = is3D ? "3d terrain" : "black map"; }

async function renderFoodBankMarkers(withinTenMiles) {
  mapController.markers.forEach((m) => m.remove()); mapController.markers = [];
  for (const place of FOOD_BANK_LOCATIONS) {
    const point = await geocodeAddress(place.address); if (!point) continue;
    if (withinTenMiles && currentUserLocation) {
      const d = milesBetween(currentUserLocation.lat, currentUserLocation.lon, point.lat, point.lon);
      if (d > 10) continue;
    }
    const marker = window.L.circleMarker([point.lat, point.lon], { radius: 5, color: "#8f8f8f", fillColor: "#7a7a7a", fillOpacity: 0.7 }).addTo(mapController.map);
    marker.bindPopup(`<strong>${place.name}</strong><br>${place.address}<br>${place.phone}<br>${place.hours}`);
    mapController.markers.push(marker);
  }
  if (mapController.markers.length) mapController.map.fitBounds(window.L.featureGroup(mapController.markers).getBounds().pad(0.2));
}

async function createMapPanel(location) {
  removeLayer(".map-panel");
  const panel = document.createElement("div"); panel.className = "map-panel";
  panel.innerHTML = `<div class="map-header"><div><div class="map-kicker">map response</div><div class="map-title">MAP VIEW</div></div><div class="map-status">black map</div></div><div class="map-frame-wrap"><div id="mapCanvas" class="map-canvas"></div></div>`;
  voiceCore.appendChild(panel); const L = await ensureLeaflet();
  mapController = { map: L.map("mapCanvas", { zoomControl: true, attributionControl: true }).setView([39.4, -84.3], 9), markers: [], is3D: false, activeLayer: null };
  setMapMode(false);
  const point = await geocodeAddress(location);
  if (point) mapController.map.flyTo([point.lat, point.lon], 12, { duration: 1.3 });
}

async function updateMapLocationInPlace(location, options = {}) {
  if (!mapController?.map) return false;
  if (options.foodBanks) { await renderFoodBankMarkers(options.withinTenMiles); return true; }
  mapController.markers.forEach((m) => m.remove()); mapController.markers = [];
  const point = await geocodeAddress(location); if (!point) return true;
  mapController.map.flyTo([point.lat, point.lon], Math.max(6, mapController.map.getZoom() - 2), { duration: 0.6 });
  window.setTimeout(() => mapController.map.flyTo([point.lat, point.lon], 13, { duration: 1.0 }), 620);
  return true;
}

async function runCommand(rawCommand = commandInput.value) {
  const normalized = rawCommand.trim().toLowerCase(); if (!normalized) return; clearTransitionTimer();
  const ask3D = /3d/.test(normalized) && visualMode === "field" && !!mapController?.map;
  if (ask3D) { setMapMode(true); commandInput.value = ""; return; }
  const ask2D = /(2d|flat|black map)/.test(normalized) && visualMode === "field" && !!mapController?.map;
  if (ask2D) { setMapMode(false); commandInput.value = ""; return; }

  const isFoodBankRequest = /food bank|food pantry|pantry/.test(normalized);
  const withinTenMiles = /10\s*mile/.test(normalized);
  const mapLocation = extractMapLocation(rawCommand) || (isFoodBankRequest ? "Southwest Ohio Food Banks" : "");
  if (mapLocation) {
    setStatus("responding"); commandInput.value = "";
    if (visualMode === "field" && mapController?.map) {
      await updateMapLocationInPlace(mapLocation, { foodBanks: isFoodBankRequest, withinTenMiles });
      return;
    }
    setVisualMode("zoom"); createZoomLayer();
    transitionTimer = window.setTimeout(async () => {
      removeLayer(".zoom-layer"); await createMapPanel(mapLocation);
      if (isFoodBankRequest) await renderFoodBankMarkers(withinTenMiles);
      setVisualMode("field"); transitionTimer = null;
    }, ZOOM_PHASE_DURATION_MS);
    return;
  }

  if (normalized.includes("reset") || normalized.includes("return") || normalized.includes("back")) {
    removeLayer(".map-panel"); if (mapController?.map) { mapController.map.remove(); mapController = null; }
    setVisualMode("core"); setStatus("listening"); commandInput.value = ""; return;
  }
}

function startVoiceCommand() { const SpeechRecognition = getSpeechRecognitionConstructor(); if (!SpeechRecognition || isListeningForSpeech) return; const recognition = new SpeechRecognition(); recognition.lang = "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onstart = () => { isListeningForSpeech = true; voiceButton.textContent = "listening"; }; recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript || ""; commandInput.value = transcript; runCommand(transcript); }; recognition.onend = () => { isListeningForSpeech = false; voiceButton.textContent = "voice"; }; recognition.onerror = () => { isListeningForSpeech = false; voiceButton.textContent = "voice"; }; recognition.start(); }

function boot() {
  createReactivePulse(); setStatus("listening"); setVisualMode("core");
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => { currentUserLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude }; }, () => {});
  if (!getSpeechRecognitionConstructor()) { voiceButton.disabled = true; voiceButton.title = "Speech recognition is not supported in this browser."; }
  app.addEventListener("click", toggleVoiceState); sendButton.addEventListener("click", () => runCommand()); commandInput.addEventListener("keydown", (event) => { if (event.key === "Enter") runCommand(); }); voiceButton.addEventListener("click", startVoiceCommand);
}
boot();
