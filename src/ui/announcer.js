/**
 * One place for user-facing feedback.
 *
 * Every message goes to both a visible toast and an aria-live region, so a
 * failed lookup is never a silent no-op the way it used to be.
 */

const TONE_GLYPH = { info: "i", success: "✓", error: "!", warn: "⚠" };
const DEFAULT_TIMEOUT_MS = 6000;

export function createAnnouncer({ stack, liveRegion }) {
  const timers = new Set();

  function announce(message) {
    if (!liveRegion) return;
    // Re-setting identical text does not re-announce; clear first.
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 60);
  }

  function toast(message, { tone = "info", timeout = DEFAULT_TIMEOUT_MS, silent = false } = {}) {
    if (!silent) announce(message);
    if (!stack) return;

    const node = document.createElement("div");
    node.className = "toast";
    node.dataset.tone = tone;
    node.dataset.glyph = TONE_GLYPH[tone] ?? TONE_GLYPH.info;
    node.textContent = message;
    stack.appendChild(node);

    const timer = window.setTimeout(() => {
      node.remove();
      timers.delete(timer);
    }, timeout);
    timers.add(timer);

    // Never let the stack grow without bound.
    while (stack.children.length > 3) stack.firstElementChild.remove();
  }

  return {
    announce,
    toast,
    info: (message, options) => toast(message, { ...options, tone: "info" }),
    success: (message, options) => toast(message, { ...options, tone: "success" }),
    error: (message, options) => toast(message, { ...options, tone: "error" }),
    warn: (message, options) => toast(message, { ...options, tone: "warn" }),
    dispose() {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    }
  };
}
