/**
 * The accessibility panel. Rendered from JS so the vision-mode list stays a
 * single definition shared with the command parser.
 */

import { VISION_MODES } from "./accessibility.js";

const SWATCH_VARS = ["--status-open", "--status-closed", "--status-appointment", "--status-user"];

function buildVisionOption(mode, current) {
  const label = document.createElement("label");
  label.className = "vision-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "vision-mode";
  input.value = mode.id;
  input.checked = mode.id === current;

  const text = document.createElement("span");
  text.className = "vision-option-text";
  text.innerHTML = `<span class="vision-option-name"></span><span class="vision-option-note"></span>`;
  text.querySelector(".vision-option-name").textContent = mode.name;
  text.querySelector(".vision-option-note").textContent = mode.note;

  // Preview swatches are scoped to the mode being offered, so the row shows
  // the palette it would switch to rather than the palette in force.
  const swatches = document.createElement("span");
  swatches.className = "swatch-row";
  swatches.dataset.vision = mode.id;
  swatches.setAttribute("aria-hidden", "true");
  for (const cssVar of SWATCH_VARS) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = `var(${cssVar})`;
    swatches.appendChild(swatch);
  }

  label.append(input, text, swatches);
  return { label, input };
}

function toggleRow({ id, label, note, checked }) {
  const row = document.createElement("label");
  row.className = "toggle-row";
  const copy = document.createElement("span");
  copy.innerHTML = `<span class="toggle-label"></span><span class="toggle-note"></span>`;
  copy.querySelector(".toggle-label").textContent = label;
  copy.querySelector(".toggle-note").textContent = note;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = checked;
  row.append(copy, input);
  return { row, input };
}

export function createSettingsPanel({ mount, accessibility, onClose }) {
  const panel = document.createElement("div");
  panel.className = "panel settings-panel";
  panel.id = "settingsPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "settingsPanelTitle");
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `<h2 class="panel-title" id="settingsPanelTitle">Accessibility</h2>`;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "icon-button";
  closeButton.setAttribute("aria-label", "Close accessibility settings");
  closeButton.textContent = "✕";
  header.appendChild(closeButton);

  const subtitle = document.createElement("p");
  subtitle.className = "panel-subtitle";
  subtitle.textContent =
    "Colour is only ever a second signal here — every status also carries a shape and a written label. Pick the palette that separates best for you.";

  const visionGroup = document.createElement("fieldset");
  visionGroup.className = "field-group";
  const visionLegend = document.createElement("legend");
  visionLegend.className = "field-legend";
  visionLegend.textContent = "Colour vision";
  const visionOptions = document.createElement("div");
  visionOptions.className = "vision-options";
  visionGroup.append(visionLegend, visionOptions);

  const current = accessibility.get();
  const visionInputs = [];
  for (const mode of VISION_MODES) {
    const { label, input } = buildVisionOption(mode, current.vision);
    input.addEventListener("change", () => {
      if (input.checked) accessibility.set({ vision: input.value });
    });
    visionInputs.push(input);
    visionOptions.appendChild(label);
  }

  const displayGroup = document.createElement("fieldset");
  displayGroup.className = "field-group";
  const displayLegend = document.createElement("legend");
  displayLegend.className = "field-legend";
  displayLegend.textContent = "Display";
  displayGroup.appendChild(displayLegend);

  const contrast = toggleRow({
    id: "prefHighContrast",
    label: "High contrast",
    note: "Brightens every hairline, scrim and label.",
    checked: current.contrast === "high"
  });
  contrast.input.addEventListener("change", () =>
    accessibility.set({ contrast: contrast.input.checked ? "high" : "normal" })
  );

  const motion = toggleRow({
    id: "prefReduceMotion",
    label: "Reduce motion",
    note: "Stops the ambient animation and skips the zoom transition.",
    checked: current.motion === "reduced"
  });
  motion.input.addEventListener("change", () =>
    accessibility.set({ motion: motion.input.checked ? "reduced" : "system" })
  );

  const labels = toggleRow({
    id: "prefMarkerLabels",
    label: "Always label map pins",
    note: "Prints each location's name next to its pin instead of on hover.",
    checked: current.markerLabels === "always"
  });
  labels.input.addEventListener("change", () =>
    accessibility.set({ markerLabels: labels.input.checked ? "always" : "hover" })
  );

  const textRow = document.createElement("div");
  textRow.className = "select-row";
  const textLabel = document.createElement("label");
  textLabel.className = "toggle-label";
  textLabel.setAttribute("for", "prefTextSize");
  textLabel.textContent = "Text size";
  const textSelect = document.createElement("select");
  textSelect.id = "prefTextSize";
  for (const [value, name] of [
    ["normal", "Normal"],
    ["large", "Large"],
    ["x-large", "Extra large"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    textSelect.appendChild(option);
  }
  textSelect.value = current.textSize;
  textSelect.addEventListener("change", () => accessibility.set({ textSize: textSelect.value }));
  textRow.append(textLabel, textSelect);

  displayGroup.append(contrast.row, motion.row, labels.row, textRow);

  const footer = document.createElement("div");
  footer.className = "panel-footer";
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "text-button";
  resetButton.textContent = "Reset";
  resetButton.addEventListener("click", () => accessibility.reset());
  footer.appendChild(resetButton);

  panel.append(header, subtitle, visionGroup, displayGroup, footer);
  mount.appendChild(panel);

  closeButton.addEventListener("click", () => onClose?.());

  // Keep the controls in step when preferences change from a typed command.
  accessibility.subscribe((preferences) => {
    for (const input of visionInputs) input.checked = input.value === preferences.vision;
    contrast.input.checked = preferences.contrast === "high";
    motion.input.checked = preferences.motion === "reduced";
    labels.input.checked = preferences.markerLabels === "always";
    textSelect.value = preferences.textSize;
  });

  return {
    element: panel,
    focusFirst() {
      (visionInputs.find((input) => input.checked) ?? visionInputs[0])?.focus();
    }
  };
}
