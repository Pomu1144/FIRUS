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

const FOOD_BANK_LOCATIONS = [
  { name: "Shared Harvest Foodbank", address: "5901 Dixie Highway, Fairfield, OH 45014-4207", phone: "800-352-3663", hours: "Regional food bank contact." },
  { name: "Freestore Foodbank", address: "112 E Liberty St, Cincinnati, OH 45202", phone: "513-482-4500", hours: "Not listed in source." },
  { name: "Mid-Ohio Food Collective", address: "3960 Brookham Dr, Grove City, OH 43123", phone: "614-274-7770", hours: "Not listed in source." },
  { name: "The Foodbank, Inc.", address: "5650 Webster St, Dayton, OH 45414", phone: "937-461-5300", hours: "Not listed in source." },
  { name: "Fairfield Food Pantry", address: "78 Donald Drive, Fairfield, OH 45014", phone: "513-829-9047", hours: "Mon/Wed/Fri noon-3 pm." },
  { name: "Hamilton Dream Center", address: "725 Campbell Ave, Hamilton, OH 45011", phone: "513-893-2800", hours: "Fri 3 pm-5 pm; 2nd and 3rd Sat 10 am-2 pm." },
  { name: "Lighthouse Food Pantry", address: "626 Ridgelawn Ave, Hamilton, OH 45013", phone: "513-867-9463", hours: "Tue 5 pm-7 pm; Sat 9:30 am-12:30 pm." },
  { name: "Salvation Army (Middletown)", address: "1914 First Avenue, Middletown, OH 45042", phone: "513-423-9452", hours: "Mon-Fri 9 am-noon and 1 pm-4 pm." },
  { name: "Oxford Choice Pantry", address: "400 West Withrow Street, Oxford, OH 45056", phone: "513-523-3857", hours: "Mon/Thu 5 pm-7 pm; Fri 2 pm-4 pm." },
  { name: "Faith Community United Methodist", address: "8230 Cox Rd, West Chester, OH 45069", phone: "513-777-9533", hours: "Tue 1 pm-2:30 pm & 6:30 pm-8 pm; Sat 10 am-11:30 am." },
  { name: "Franklin Area Community Services", address: "345 S. Main Street, Franklin, OH 45005", phone: "937-746-7791", hours: "Mon-Fri noon-3 pm; Wed 5 pm-7 pm." },
  { name: "Lebanon Food Pantry", address: "190 New Street, Lebanon, OH 45036", phone: "513-932-3617", hours: "Mon/Wed/Fri 9 am-noon; Wed 6 pm-8 pm." },
  { name: "Mason Food Pantry", address: "406 Fourth Avenue, Mason, OH 45040", phone: "513-754-0333", hours: "Mon 6:30 pm-7:30 pm; Wed/Sat 9:30 am-11 am." },
  { name: "Springboro Community Assistance Center", address: "40 Florence Avenue, Springboro, OH 45066", phone: "937-572-6488", hours: "2nd and 4th week Tue/Wed 4 pm-6 pm; Thu 1 pm-3 pm." },
  { name: "Amelia United Methodist Church", address: "19 E Main St, Amelia, OH 45102", phone: "513-753-6770", hours: "Mon and Wed 11 am-1 pm." },
  { name: "Inter Parish Ministry", address: "4623 Aicholtz Rd, Cincinnati, OH 45244", phone: "513-561-3932", hours: "Drive-thru Mon/Tue/Thu/Fri 10 am-noon." },
  { name: "Milford Miami Ministries", address: "844 Ohio 131, Milford, OH 45150", phone: "513-248-1114", hours: "Tue/Thu 9 am-noon; Wed 6:30 pm-8 pm." },
  { name: "SEM", address: "2020 Beechmont Ave, Cincinnati, OH 45230", phone: "513-231-1412", hours: "By appointment Mon-Fri 10 am-2 pm; Tue evening; Sat morning." },
  { name: "Williamsburg Emergency Mission", address: "330 Gay St, Williamsburg, OH 45176", phone: "513-724-6305", hours: "Tue and Wed 10 am-noon." }
];

function clearTransitionTimer() { if (transitionTimer !== null) { window.clearTimeout(transitionTimer); transitionTimer = null; } }
function setStatus(nextStatus) { status = nextStatus; coreShell.classList.toggle("responding", status === "responding"); reactivePulse.hidden = !(status === "responding" && visualMode === "core"); updateLabel(); }
function setVisualMode(nextMode) { visualMode = nextMode; app.classList.toggle("zooming", visualMode === "zoom"); coreShell.classList.toggle("hidden-for-zoom", visualMode === "zoom"); coreShell.classList.toggle("hidden-for-field", visualMode === "field"); coreShell.classList.toggle("reassembling", visualMode === "reassemble"); reactivePulse.hidden = !(status === "responding" && visualMode === "core"); commandInput.placeholder = visualMode === "field" ? 'Type "reset" to return to Firus...' : 'Type "show" or "map of Columbus, Ohio"...'; updateLabel(); }
function updateLabel() { statusLabel.textContent = visualMode === "core" ? statusCopy[status] : statusCopy[visualMode]; }
function toggleVoiceState(event) { if (event.target.closest("[data-command-ui='true'], input, button")) return; if (visualMode !== "core") return; setStatus(status === "responding" ? "listening" : "responding"); }
function removeLayer(selector) { document.querySelectorAll(selector).forEach((node) => node.remove()); }
function ensureLeaflet() {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; js.onload = () => resolve(window.L); js.onerror = reject; document.body.appendChild(js);
  });
  return leafletReady;
}
async function geocodeAddress(query) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}
async function createMapPanel(location, { foodBanks = false } = {}) {
  removeLayer(".map-panel");
  const panel = document.createElement("div"); panel.className = "map-panel";
  panel.innerHTML = `<div class="map-header"><div><div class="map-kicker">map response</div><div class="map-title">${location}</div></div><div class="map-status">interactive map</div></div><div class="map-controls"><button class="ghost-button map-btn" id="toggle3dBtn" type="button">3D view</button></div><div class="map-frame-wrap"><div id="mapCanvas" class="map-canvas"></div></div>`;
  voiceCore.appendChild(panel);
  const L = await ensureLeaflet();
  mapController = { is3D: false, centerLabel: location };
  const map = L.map("mapCanvas", { zoomControl: true, attributionControl: true }).setView([39.4, -84.3], 9);
  mapController.map = map;
  mapController.markers = [];
  const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 });
  dark.addTo(map);
  mapController.darkLayer = dark;

  if (foodBanks) {
    for (const place of FOOD_BANK_LOCATIONS) {
      const point = await geocodeAddress(place.address);
      if (!point) continue;
      const marker = L.circleMarker([point.lat, point.lon], { radius: 5, color: "#fff", fillColor: "#d8d8d8", fillOpacity: 0.95 }).addTo(map);
      marker.bindPopup(`<strong>${place.name}</strong><br>${place.address}<br>${place.phone}<br>${place.hours}`);
      mapController.markers.push(marker);
    }
    if (mapController.markers.length) {
      const bounds = L.featureGroup(mapController.markers).getBounds().pad(0.2);
      map.fitBounds(bounds);
    }
  } else {
    const point = await geocodeAddress(location);
    if (point) {
      const marker = L.circleMarker([point.lat, point.lon], { radius: 7, color: "#fff", fillColor: "#fff", fillOpacity: 1 }).addTo(map);
      marker.bindPopup(`<strong>${location}</strong>`).openPopup();
      map.setView([point.lat, point.lon], 12);
      mapController.markers.push(marker);
    }
  }

  panel.querySelector("#toggle3dBtn").addEventListener("click", () => {
    mapController.is3D = !mapController.is3D;
    const c = map.getCenter();
    const z = map.getZoom();
    const mode = mapController.is3D ? "satellite" : "m";
    window.open(`https://www.google.com/maps/@?api=1&map_action=map&center=${c.lat},${c.lng}&zoom=${z}&basemap=${mode}`, "_blank", "noopener");
  });
}
async function updateMapLocationInPlace(location, opts) {
  if (!mapController || !mapController.map) return false;
  document.querySelector(".map-title").textContent = location;
  mapController.markers.forEach((m) => m.remove());
  mapController.markers = [];
  if (opts?.foodBanks) {
    for (const place of FOOD_BANK_LOCATIONS) {
      const point = await geocodeAddress(place.address);
      if (!point) continue;
      const marker = window.L.circleMarker([point.lat, point.lon], { radius: 5, color: "#fff", fillColor: "#d8d8d8", fillOpacity: 0.95 }).addTo(mapController.map);
      marker.bindPopup(`<strong>${place.name}</strong><br>${place.address}<br>${place.phone}<br>${place.hours}`);
      mapController.markers.push(marker);
    }
    if (mapController.markers.length) mapController.map.fitBounds(window.L.featureGroup(mapController.markers).getBounds().pad(0.2));
  } else {
    const point = await geocodeAddress(location);
    if (!point) return true;
    const marker = window.L.circleMarker([point.lat, point.lon], { radius: 7, color: "#fff", fillColor: "#fff", fillOpacity: 1 }).addTo(mapController.map);
    marker.bindPopup(`<strong>${location}</strong>`).openPopup();
    mapController.markers.push(marker);
    mapController.map.flyTo([point.lat, point.lon], 12, { duration: 1.4 });
  }
  return true;
}

function extractMapLocation(command) { const text = command.trim().toLowerCase(); const original = command.trim(); if (text.startsWith("where is ")) return original.slice(9).replace(/[.!?]+$/g, "").trim(); if (!text.includes("map")) return ""; for (const p of ["show me a map of ","show me map of ","show map of ","show a map of ","open a map of ","open map of ","pull up a map of ","pull up map of ","display a map of ","display map of ","map of ","map for ","map to ","map in ","map near ","map around "]) if (text.startsWith(p)) return original.slice(p.length).replace(/[.!?]+$/g, "").trim(); return ""; }
function createZoomLayer(){removeLayer('.zoom-layer');const l=document.createElement('div');l.className='zoom-layer';l.innerHTML='<div class="zoom-flash"></div><div class="zoom-ring"></div><div class="zoom-core-burst"></div><div class="zoom-vignette"></div>';document.body.appendChild(l);}
function runCommand(rawCommand = commandInput.value) {
  const normalized = rawCommand.trim().toLowerCase(); if (!normalized) return; clearTransitionTimer();
  const isFoodBankRequest = /food bank|food pantry|pantry/.test(normalized);
  const mapLocation = extractMapLocation(normalized) || (isFoodBankRequest ? "Southwest Ohio Food Banks" : "");
  if (mapLocation) {
    setStatus("responding"); commandInput.value = "";
    if (visualMode === "field" && document.querySelector('.map-panel')) { updateMapLocationInPlace(mapLocation, { foodBanks: isFoodBankRequest }); return; }
    setVisualMode("zoom"); createZoomLayer();
    transitionTimer = window.setTimeout(async () => { removeLayer(".zoom-layer"); removeLayer(".particle-field"); await createMapPanel(mapLocation, { foodBanks: isFoodBankRequest }); setVisualMode("field"); transitionTimer = null; }, ZOOM_PHASE_DURATION_MS); return;
  }
  if (normalized.includes("reset") || normalized.includes("return") || normalized.includes("back")) { removeLayer(".map-panel"); if (mapController?.map) { mapController.map.remove(); mapController = null; } setVisualMode("core"); setStatus("listening"); commandInput.value = ""; return; }
}
function boot(){setStatus('listening');setVisualMode('core');app.addEventListener('click',toggleVoiceState);sendButton.addEventListener('click',()=>runCommand());commandInput.addEventListener('keydown',e=>{if(e.key==='Enter')runCommand();});}
boot();
