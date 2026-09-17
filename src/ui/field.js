/**
 * Particle visuals: the zoom "domain expansion", the particle field it lands
 * on, and the reassemble pass that pulls the field back into the core.
 *
 * The CSS for all of this already existed but nothing ever built the nodes, so
 * `show` did nothing. Counts scale with the viewport and drop to zero under
 * reduced motion.
 */

const BASE_COUNTS = { streaks: 82, dust: 90, shards: 26, field: 125, reassemble: 72, ticks: 24 };

const random = (min, max) => min + Math.random() * (max - min);

/**
 * Particle budget as a fraction of a 1440x900 reference viewport, clamped so
 * phones stay smooth and huge displays do not get sparse.
 */
function densityScale() {
  const area = window.innerWidth * window.innerHeight;
  const ratio = area / (1440 * 900);
  const cores = navigator.hardwareConcurrency ?? 4;
  const budget = cores <= 4 ? 0.65 : 1;
  return Math.min(1.25, Math.max(0.35, Math.sqrt(ratio) * budget));
}

const scaleCount = (base) => Math.round(base * densityScale());

function radius() {
  return Math.max(window.innerWidth, window.innerHeight) * 0.75;
}

export function removeLayer(selector) {
  document.querySelectorAll(selector).forEach((node) => node.remove());
}

export function createZoomLayer({ reducedMotion = false } = {}) {
  removeLayer(".zoom-layer");

  const layer = document.createElement("div");
  layer.className = "zoom-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    '<div class="zoom-flash"></div><div class="zoom-ring"></div><div class="zoom-core-burst"></div><div class="zoom-vignette"></div>';

  for (let i = 0; i < 4; i += 1) {
    const ring = document.createElement("div");
    ring.className = "zoom-depth-ring";
    ring.style.animationDelay = `${i * 0.09}s`;
    ring.style.setProperty("--ring-opacity", `${0.28 - i * 0.045}`);
    ring.style.setProperty("--ring-scale", `${2.4 + i * 0.62}`);
    layer.appendChild(ring);
  }

  if (!reducedMotion) {
    const reach = radius();

    for (let i = 0; i < scaleCount(BASE_COUNTS.streaks); i += 1) {
      const angle = random(0, Math.PI * 2);
      const start = random(20, 120);
      const end = random(reach * 0.55, reach * 1.25);
      const streak = document.createElement("div");
      streak.className = "streak";
      streak.style.width = `${random(26, 120)}px`;
      streak.style.setProperty("--sx", `${Math.cos(angle) * start}px`);
      streak.style.setProperty("--sy", `${Math.sin(angle) * start}px`);
      streak.style.setProperty("--ex", `${Math.cos(angle) * end}px`);
      streak.style.setProperty("--ey", `${Math.sin(angle) * end}px`);
      streak.style.setProperty("--rot", `${(angle * 180) / Math.PI}deg`);
      streak.style.setProperty("--o", `${random(0.25, 0.9)}`);
      streak.style.animationDelay = `${random(0, 0.5)}s`;
      layer.appendChild(streak);
    }

    for (let i = 0; i < scaleCount(BASE_COUNTS.dust); i += 1) {
      const angle = random(0, Math.PI * 2);
      const start = random(10, 90);
      const end = random(reach * 0.4, reach * 1.1);
      const size = random(1, 3);
      const dust = document.createElement("div");
      dust.className = "zoom-dust";
      dust.style.width = `${size}px`;
      dust.style.height = `${size}px`;
      dust.style.setProperty("--sx", `${Math.cos(angle) * start}px`);
      dust.style.setProperty("--sy", `${Math.sin(angle) * start}px`);
      dust.style.setProperty("--ex", `${Math.cos(angle) * end}px`);
      dust.style.setProperty("--ey", `${Math.sin(angle) * end}px`);
      dust.style.setProperty("--s", `${random(0.6, 2.2)}`);
      dust.style.setProperty("--o", `${random(0.2, 0.85)}`);
      dust.style.animationDelay = `${random(0, 0.65)}s`;
      layer.appendChild(dust);
    }

    for (let i = 0; i < scaleCount(BASE_COUNTS.shards); i += 1) {
      const angle = random(0, Math.PI * 2);
      const start = random(40, 150);
      const end = random(reach * 0.5, reach);
      const shard = document.createElement("div");
      shard.className = "zoom-shard";
      shard.style.width = `${random(50, 180)}px`;
      shard.style.setProperty("--sx", `${Math.cos(angle) * start}px`);
      shard.style.setProperty("--sy", `${Math.sin(angle) * start}px`);
      shard.style.setProperty("--ex", `${Math.cos(angle) * end}px`);
      shard.style.setProperty("--ey", `${Math.sin(angle) * end}px`);
      shard.style.setProperty("--rot", `${(angle * 180) / Math.PI}deg`);
      shard.style.setProperty("--o", `${random(0.2, 0.7)}`);
      shard.style.animationDelay = `${random(0, 0.4)}s`;
      layer.appendChild(shard);
    }
  }

  document.body.appendChild(layer);
  return layer;
}

/** The particle field the zoom lands on when no map was requested. */
export function createParticleField(mount) {
  removeLayer(".particle-field");

  const field = document.createElement("div");
  field.className = "particle-field";
  field.setAttribute("aria-hidden", "true");

  const ring = document.createElement("div");
  ring.className = "field-ring";
  field.appendChild(ring);

  const spread = 0.46; // fraction of --core-size the cloud occupies
  const size = mount.getBoundingClientRect().width || 620;

  for (let i = 0; i < scaleCount(BASE_COUNTS.field); i += 1) {
    const angle = random(0, Math.PI * 2);
    const distance = Math.sqrt(Math.random()) * size * spread;
    const dot = document.createElement("div");
    dot.className = "field-particle";
    const dotSize = random(1, 2.8);
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    dot.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    dot.style.setProperty("--o", `${random(0.25, 0.85)}`);
    dot.style.setProperty("--drift", `${random(4.5, 9)}s`);
    dot.style.setProperty("--delay", `${random(0, 3)}s`);
    field.appendChild(dot);
  }

  const ticks = scaleCount(BASE_COUNTS.ticks);
  for (let i = 0; i < ticks; i += 1) {
    const tick = document.createElement("div");
    tick.className = `field-tick ${i % 4 === 0 ? "major" : "minor"}`;
    tick.style.setProperty("--angle", `${(360 / ticks) * i}deg`);
    tick.style.setProperty("--delay", `${(i / ticks) * 2}s`);
    field.appendChild(tick);
  }

  mount.appendChild(field);
  return field;
}

/** Collapses the field back toward the core. Resolves when the pass is done. */
export function reassembleField(mount, { reducedMotion = false } = {}) {
  removeLayer(".particle-field");
  removeLayer(".reassemble-field");
  if (reducedMotion) return Promise.resolve();

  const field = document.createElement("div");
  field.className = "reassemble-field";
  field.setAttribute("aria-hidden", "true");
  const size = mount.getBoundingClientRect().width || 620;

  for (let i = 0; i < scaleCount(BASE_COUNTS.reassemble); i += 1) {
    const angle = random(0, Math.PI * 2);
    const distance = random(size * 0.2, size * 0.52);
    const dot = document.createElement("div");
    dot.className = "reassemble-particle";
    const dotSize = random(1, 2.6);
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    dot.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    dot.style.setProperty("--o", `${random(0.25, 0.8)}`);
    dot.style.animationDelay = `${random(0, 0.18)}s`;
    field.appendChild(dot);
  }

  mount.appendChild(field);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      field.remove();
      resolve();
    }, 1000);
  });
}
