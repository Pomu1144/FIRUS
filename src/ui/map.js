/**
 * Map panel: Leaflet map, accessible marker layer and the text results list.
 *
 * Scaling notes
 * -------------
 * - Markers are culled to the padded viewport and grid-clustered once the set
 *   is larger than CLUSTER_THRESHOLD, so the layer cost tracks what is on
 *   screen rather than the size of the dataset.
 * - Re-renders are coalesced into an animation frame; pan/zoom fires far more
 *   often than the layer needs rebuilding.
 */

import { OPEN_STATUS, STATUS_LABEL, openStatus } from "../lib/hours.js";
import { formatDistance } from "../lib/geo.js";
import { MARKER_GLYPH, clusterMarkerHTML, placeMarkerHTML, userMarkerHTML } from "./markers.js";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_TIMEOUT_MS = 12000;

const CLUSTER_THRESHOLD = 40;
const LABEL_MIN_ZOOM = 11;
const CLUSTER_CELL_PX = 72;
const VIEWPORT_PAD = 0.35;

const BASEMAPS = {
  // CARTO's free dark basemap now watermarks tiles with "API key required", so
  // the black map is built from keyless OSM tiles inverted in CSS instead.
  flat: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      className: "basemap-inverted",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    label: "black map"
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)'
    },
    label: "3d terrain"
  }
};

let leafletPromise = null;

/** Loads Leaflet once, and rejects rather than hanging if the CDN is blocked. */
export function ensureLeaflet() {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;

    const timer = window.setTimeout(() => {
      script.remove();
      leafletPromise = null;
      reject(new Error("Timed out loading the map library."));
    }, LEAFLET_TIMEOUT_MS);

    script.onload = () => {
      window.clearTimeout(timer);
      window.L ? resolve(window.L) : reject(new Error("Map library loaded but did not register."));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      leafletPromise = null;
      reject(new Error("Could not load the map library."));
    };

    document.head.appendChild(script);
  });

  return leafletPromise;
}

function buildPanel() {
  const panel = document.createElement("section");
  panel.className = "map-panel";
  panel.setAttribute("aria-label", "Map results");
  panel.innerHTML = `
    <div class="map-header">
      <div>
        <div class="map-kicker">map response</div>
        <h2 class="map-title" id="mapTitle">Map view</h2>
      </div>
      <div class="map-header-actions">
        <span class="map-status" data-role="basemap">black map</span>
        <button type="button" class="icon-button" data-role="close" aria-label="Close the map and return to the core">&#10005;</button>
      </div>
    </div>
    <div class="map-body">
      <div class="map-frame-wrap">
        <div class="map-canvas" data-role="canvas"></div>
      </div>
      <div class="map-sidebar">
        <div class="map-sidebar-title">
          <span>Locations</span>
          <span data-role="count"></span>
        </div>
        <ul class="result-list" data-role="list"></ul>
        <div class="map-legend" data-role="legend"></div>
      </div>
    </div>`;
  return panel;
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.dataset.status = status;
  badge.dataset.glyph = MARKER_GLYPH[status] ?? "";
  badge.textContent = STATUS_LABEL[status];
  return badge;
}

function renderLegend(container) {
  const entries = [
    [OPEN_STATUS.OPEN, "var(--status-open)"],
    [OPEN_STATUS.CLOSED, "var(--status-closed)"],
    [OPEN_STATUS.APPOINTMENT, "var(--status-appointment)"],
    [OPEN_STATUS.UNKNOWN, "var(--status-unknown)"]
  ];
  container.innerHTML = "";

  for (const [status, color] of entries) {
    const item = document.createElement("span");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20">${
      placeMarkerHTML({ status, color, label: "" }).match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1]
    }</svg>`;
    item.append(swatch, document.createTextNode(STATUS_LABEL[status]));
    container.appendChild(item);
  }

  const you = document.createElement("span");
  you.className = "legend-item";
  you.innerHTML = `<span class="legend-swatch" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 26 26"><circle cx="13" cy="13" r="9" fill="none" stroke="var(--status-user)" stroke-width="2.4" /><path d="M13 1 V5 M13 21 V25 M1 13 H5 M21 13 H25" stroke="var(--status-user)" stroke-width="2.4" stroke-linecap="round" /></svg></span>`;
  you.append(document.createTextNode("Your location"));
  container.appendChild(you);
}

export function createMapPanel({ mount, L, accessibility, announcer, onClose, view }) {
  const panel = buildPanel();
  mount.appendChild(panel);

  const canvas = panel.querySelector('[data-role="canvas"]');
  const listEl = panel.querySelector('[data-role="list"]');
  const countEl = panel.querySelector('[data-role="count"]');
  const basemapEl = panel.querySelector('[data-role="basemap"]');
  const titleEl = panel.querySelector("#mapTitle");
  const legendEl = panel.querySelector('[data-role="legend"]');

  panel.querySelector('[data-role="close"]').addEventListener("click", () => onClose?.());

  const map = L.map(canvas, {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true
  }).setView([view.lat, view.lon], view.zoom);

  const markerLayer = L.layerGroup().addTo(map);
  let baseLayer = null;
  let basemapMode = "flat";
  let places = [];
  let origin = null;
  let userMarker = null;
  let renderHandle = 0;
  let clusteringActive = false;
  let destroyed = false;

  renderLegend(legendEl);

  function setBasemap(mode) {
    const config = BASEMAPS[mode] ?? BASEMAPS.flat;
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(config.url, config.options).addTo(map);
    baseLayer.bringToBack();
    basemapMode = BASEMAPS[mode] ? mode : "flat";
    basemapEl.textContent = config.label;
    return basemapMode;
  }

  function paletteColor(status) {
    const palette = accessibility.palette();
    return (
      {
        [OPEN_STATUS.OPEN]: palette.open,
        [OPEN_STATUS.CLOSED]: palette.closed,
        [OPEN_STATUS.APPOINTMENT]: palette.appointment,
        [OPEN_STATUS.UNKNOWN]: palette.unknown
      }[status] ?? palette.unknown
    );
  }

  function popupHTML(place) {
    const status = openStatus(place);
    const distance = formatDistance(place.distanceMiles);
    const telHref = `tel:${place.phone.replace(/[^0-9+]/g, "")}`;
    const directions = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`;
    return `<div class="popup-name">${place.name}</div>
      <div>${place.address}</div>
      <div><a href="${telHref}">${place.phone}</a></div>
      <div>${place.hoursText}</div>
      <div><strong>${STATUS_LABEL[status]}</strong>${distance ? ` · ${distance} away` : ""}</div>
      <div><a href="${directions}" target="_blank" rel="noopener noreferrer">Open in OpenStreetMap</a></div>`;
  }

  function placeMarker(place) {
    const status = openStatus(place);
    const icon = L.divIcon({
      className: "marker-wrapper",
      html: placeMarkerHTML({ status, color: paletteColor(status), label: place.name }),
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
    const marker = L.marker([place.lat, place.lon], {
      icon,
      keyboard: true,
      title: `${place.name} — ${STATUS_LABEL[status]}`,
      alt: `${place.name}, ${STATUS_LABEL[status]}`
    });
    marker.bindPopup(popupHTML(place));
    marker.placeId = place.id;
    return marker;
  }

  /** Grid-clusters by screen position, so cells stay stable as you zoom. */
  function clusterVisible(visible) {
    const cells = new Map();
    for (const place of visible) {
      const point = map.latLngToLayerPoint([place.lat, place.lon]);
      const key = `${Math.floor(point.x / CLUSTER_CELL_PX)}:${Math.floor(point.y / CLUSTER_CELL_PX)}`;
      const cell = cells.get(key);
      if (cell) cell.push(place);
      else cells.set(key, [place]);
    }
    return [...cells.values()];
  }

  function renderMarkers() {
    if (destroyed) return;
    panel.dataset.labelsFit = String(map.getZoom() >= LABEL_MIN_ZOOM);
    markerLayer.clearLayers();
    if (!places.length) return;

    const bounds = map.getBounds().pad(VIEWPORT_PAD);
    const visible = places.filter((place) => bounds.contains([place.lat, place.lon]));
    clusteringActive = places.length > CLUSTER_THRESHOLD;

    if (!clusteringActive) {
      for (const place of visible) markerLayer.addLayer(placeMarker(place));
      return;
    }

    for (const group of clusterVisible(visible)) {
      if (group.length === 1) {
        markerLayer.addLayer(placeMarker(group[0]));
        continue;
      }
      const lat = group.reduce((sum, place) => sum + place.lat, 0) / group.length;
      const lon = group.reduce((sum, place) => sum + place.lon, 0) / group.length;
      const { html, size } = clusterMarkerHTML(group.length);
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({ className: "marker-wrapper", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        keyboard: true,
        title: `${group.length} locations — activate to zoom in`,
        alt: `Cluster of ${group.length} locations`
      });
      marker.on("click keypress", () => {
        map.fitBounds(L.latLngBounds(group.map((place) => [place.lat, place.lon])).pad(0.3));
      });
      markerLayer.addLayer(marker);
    }
  }

  function scheduleRender() {
    if (renderHandle) return;
    renderHandle = requestAnimationFrame(() => {
      renderHandle = 0;
      renderMarkers();
    });
  }

  function renderList() {
    listEl.innerHTML = "";
    countEl.textContent = places.length ? `${places.length}` : "";

    if (!places.length) {
      const empty = document.createElement("li");
      empty.className = "result-empty";
      empty.textContent =
        "No locations on the map yet. Try “food banks near me” or “map of Cincinnati”.";
      listEl.appendChild(empty);
      return;
    }

    for (const place of places) {
      const status = openStatus(place);
      const item = document.createElement("li");
      item.className = "result-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-button";

      const name = document.createElement("span");
      name.className = "result-name";
      name.textContent = place.name;

      const meta = document.createElement("span");
      meta.className = "result-meta";
      const distance = formatDistance(place.distanceMiles);
      meta.textContent = [place.address, distance && `${distance} away`, place.phone]
        .filter(Boolean)
        .join(" · ");

      const hours = document.createElement("span");
      hours.className = "result-meta";
      hours.textContent = place.hoursText;

      button.append(name, meta, hours, statusBadge(status));
      button.addEventListener("click", () => focusPlace(place.id));
      item.appendChild(button);
      listEl.appendChild(item);
    }
  }

  function focusPlace(id) {
    const place = places.find((candidate) => candidate.id === id);
    if (!place) return;
    map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
    map.once("moveend", () => {
      const marker = markerLayer
        .getLayers()
        .find((layer) => layer.placeId === place.id);
      marker?.openPopup();
    });
    announcer?.announce(`${place.name}. ${STATUS_LABEL[openStatus(place)]}. ${place.address}`);
  }

  function setPlaces(nextPlaces, { fit = true } = {}) {
    places = nextPlaces;
    renderList();
    renderMarkers();
    if (fit && places.length) {
      const bounds = L.latLngBounds(places.map((place) => [place.lat, place.lon]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 13 });
    }
  }

  function setUserLocation(location) {
    origin = location;
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
    if (!location) return;
    userMarker = L.marker([location.lat, location.lon], {
      icon: L.divIcon({
        className: "marker-wrapper",
        html: userMarkerHTML(accessibility.palette().user),
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      }),
      keyboard: true,
      title: "Your location",
      alt: "Your location",
      zIndexOffset: 1000
    }).addTo(map);
  }

  map.on("moveend zoomend", scheduleRender);

  // Repaint marker artwork whenever the palette changes.
  const unsubscribe = accessibility.subscribe(() => {
    renderMarkers();
    if (origin) setUserLocation(origin);
  });

  setBasemap("flat");
  renderList();

  // The panel animates in; Leaflet needs the final size.
  requestAnimationFrame(() => map.invalidateSize());
  window.setTimeout(() => !destroyed && map.invalidateSize(), 800);

  const onResize = () => !destroyed && map.invalidateSize();
  window.addEventListener("resize", onResize);

  return {
    element: panel,
    map,
    get basemap() {
      return basemapMode;
    },
    get clustering() {
      return clusteringActive;
    },
    get placeCount() {
      return places.length;
    },
    setBasemap,
    setPlaces,
    setUserLocation,
    focusPlace,
    setTitle(text) {
      titleEl.textContent = text;
    },
    flyTo(lat, lon, zoom = 13) {
      map.flyTo([lat, lon], zoom, { duration: 1 });
    },
    /** Pull back then push in, so an in-place change still reads as a move. */
    hopTo(lat, lon, zoom = 13) {
      const pullBack = Math.max(6, map.getZoom() - 2);
      map.flyTo([lat, lon], pullBack, { duration: 0.6 });
      map.once("moveend", () => !destroyed && map.flyTo([lat, lon], zoom, { duration: 1 }));
    },
    destroy() {
      destroyed = true;
      if (renderHandle) cancelAnimationFrame(renderHandle);
      unsubscribe();
      window.removeEventListener("resize", onResize);
      map.remove();
      panel.remove();
    }
  };
}
