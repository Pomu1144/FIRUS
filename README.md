# FIRUS

A voice-and-text interface that finds food banks in southwest Ohio on an
accessible map, wrapped in the FIRUS ambient core visual.

No build step, no framework: plain ES modules, plain CSS, Leaflet loaded from a
CDN at the moment a map is first requested.

```bash
npm start          # serves the site at http://127.0.0.1:4173
npm test           # Playwright suite, desktop + mobile
```

`npm start` is required — ES modules do not load over `file://`. Any static
server works; GitHub Pages serves the repository as-is.

## Commands

Type them in the command bar or say them with the voice button. `help` (or `?`)
lists them in the app.

| Say or type | What happens |
| --- | --- |
| `show` | Opens the particle field |
| `map of Cincinnati` / `where is Fairfield, OH` | Flies the map to a place |
| `food banks near me` | Plots every location, nearest first |
| `food pantries within 10 miles` | Filters by distance from you |
| `food banks open now` | Only what is open at this moment |
| `food banks in Hamilton OH` | Centres on a named place instead of you |
| `3d` / `2d` | Terrain tiles or the black basemap |
| `where am i` | Finds and marks your location |
| `colorblind mode` | Switches to the universal safe palette |
| `deuteranopia` / `protanopia` / `tritanopia` / `achromatopsia` | A specific palette |
| `high contrast`, `reduce motion`, `large text`, `labels on` | Display preferences |
| `settings` | Opens the accessibility panel |
| `reset` | Returns to the core |

Keyboard: `/` focuses the command bar, `?` opens the command list, `Esc` closes a
panel or returns to the core.

## Accessibility

Colour is never the only signal. Every food bank status carries three redundant
channels at once:

| Status | Shape | Words | Colour |
| --- | --- | --- | --- |
| Open now | filled circle | "Open now" | `--status-open` |
| Closed now | triangle | "Closed now" | `--status-closed` |
| By appointment | diamond | "By appointment" | `--status-appointment` |
| Hours unknown | hollow square | "Hours unknown" | `--status-unknown` |
| Your location | crosshair | "Your location" | `--status-user` |

Six colour-vision palettes are selectable (and persist): monochrome (the
original look), **universal** (the Okabe–Ito set, distinct under every common
type of colour blindness), deuteranopia, protanopia, tritanopia and
achromatopsia. Each redefines custom properties on `<html>`; the map markers
read the same properties back through `getComputedStyle`, so there is one
source of truth for colour.

Also built in:

- High contrast mode, adjustable text size, always-on map pin labels.
- Reduced motion, honouring `prefers-reduced-motion` and overridable both ways.
- A text results list beside the map carrying the same data as the pins, so the
  map is never the only way to reach the information.
- An `aria-live` region announcing every state change, and toasts for every
  failure (a place that cannot be found, a denied location permission, a map
  library that will not load).
- Visible focus rings, a skip link, labelled controls and `Esc` to back out.

The suite asserts text clears WCAG AA (4.5:1) and status colours clear the 3:1
non-text floor, in all six palettes.

## Layout

```
index.html
css/     tokens (palettes + preferences) · base · core · field · map · panels
src/
  main.js              wiring, the visual state machine, command routing
  commands.js          pure command parser
  data/food-banks.js   the directory, with pre-resolved coordinates
  lib/                 geo · hours ("open now") · geocode client · storage
  ui/                  core visuals · particle field · map · markers · panels
tests/app.spec.js      Playwright suite (third-party services stubbed)
```

### Notes on scale

- Food bank coordinates are resolved at build time, not at runtime. The list
  used to cost one Nominatim request per entry on every search.
- Free-text lookups are cached, deduplicated, abortable and throttled to the
  one-request-per-second the public endpoint asks for.
- Markers are culled to the padded viewport and grid-clustered past 40
  locations, so the layer cost tracks what is on screen rather than the size of
  the dataset.
- Particle counts scale with viewport area and core count.
- The black basemap is built from keyless OSM raster tiles inverted to
  greyscale in CSS. CARTO's free dark tiles now watermark "API key required".

## Data

Locations and opening hours are from published directories for southwest Ohio;
several entries list no hours at source and are shown as "Hours unknown". Hours
are evaluated in `America/New_York` regardless of where the viewer is.

Map tiles: OpenStreetMap and OpenTopoMap. Geocoding: Nominatim. All are used
within their public usage policies and attributed in the map panel.
