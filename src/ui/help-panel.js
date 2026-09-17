/** The command reference sheet. */

import { COMMAND_HELP } from "../commands.js";

export function createHelpPanel({ mount, onClose }) {
  const panel = document.createElement("div");
  panel.className = "panel help-panel";
  panel.id = "helpPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "helpPanelTitle");
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `<h2 class="panel-title" id="helpPanelTitle">Commands</h2>`;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "icon-button";
  closeButton.setAttribute("aria-label", "Close the command list");
  closeButton.textContent = "✕";
  closeButton.addEventListener("click", () => onClose?.());
  header.appendChild(closeButton);

  const subtitle = document.createElement("p");
  subtitle.className = "panel-subtitle";
  subtitle.textContent = "Type these in the command bar, or say them with the voice button.";

  const table = document.createElement("table");
  table.className = "command-table";
  table.innerHTML = "<thead><tr><th>Say or type</th><th>What happens</th></tr></thead>";
  const body = document.createElement("tbody");
  for (const [command, description] of COMMAND_HELP) {
    const row = document.createElement("tr");
    const key = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = command;
    key.appendChild(code);
    const value = document.createElement("td");
    value.textContent = description;
    row.append(key, value);
    body.appendChild(row);
  }
  table.appendChild(body);

  panel.append(header, subtitle, table);
  mount.appendChild(panel);

  return {
    element: panel,
    focusFirst() {
      closeButton.focus();
    }
  };
}
