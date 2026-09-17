import { expect, test } from "@playwright/test";

/**
 * Network policy for the suite: the two third-party services the app talks to
 * (the Leaflet CDN and Nominatim) are stubbed, so the tests assert on FIRUS's
 * behaviour rather than on somebody else's uptime. Leaflet itself is served
 * from node_modules so the real map code still runs.
 */
async function stubNetwork(page, { geocode = "ok" } = {}) {
  await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
    if (geocode === "empty") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (geocode === "network") return route.abort("failed");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { lat: "39.1031", lon: "-84.5120", display_name: "Cincinnati, Hamilton County, Ohio, United States" }
      ])
    });
  });

  await page.route("**/unpkg.com/leaflet@1.9.4/dist/leaflet.js", (route) =>
    route.fulfill({ path: "node_modules/leaflet/dist/leaflet.js", contentType: "application/javascript" })
  );
  await page.route("**/unpkg.com/leaflet@1.9.4/dist/leaflet.css", (route) =>
    route.fulfill({ path: "node_modules/leaflet/dist/leaflet.css", contentType: "text/css" })
  );
  // Never fetch real map tiles in tests.
  await page.route(/(tile\.openstreetmap\.org|tile\.opentopomap\.org)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      )
    })
  );
}

async function run(page, command) {
  await page.fill("#commandInput", command);
  await page.click("#sendButton");
}

test.beforeEach(async ({ page }) => {
  await stubNetwork(page);
  await page.goto("/index.html");
  await expect(page.locator("#statusLabel")).toHaveText("listening");
});

test.describe("core", () => {
  test("boots with the orb and an accessible command bar", async ({ page }) => {
    await expect(page.locator("#voiceCore")).toBeVisible();
    await expect(page.locator("#commandInput")).toHaveAttribute("aria-describedby", "commandHint");
    await expect(page.locator("#liveRegion")).toHaveAttribute("aria-live", "polite");
  });

  test("`show` opens the particle field that used to do nothing", async ({ page }) => {
    await run(page, "show");
    await expect(page.locator(".particle-field")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".field-particle").first()).toBeAttached();
    await expect(page.locator("#statusLabel")).toHaveText("visualizing");
  });

  test("reset returns to the core", async ({ page }) => {
    await run(page, "show");
    await expect(page.locator(".particle-field")).toBeVisible({ timeout: 10000 });
    await run(page, "reset");
    await expect(page.locator(".particle-field")).toHaveCount(0);
    await expect(page.locator("#statusLabel")).toHaveText("listening");
  });

  test("an unknown command says so instead of failing silently", async ({ page }) => {
    await run(page, "banana bread");
    await expect(page.locator(".toast")).toContainText("not a command yet");
  });

  test("help is reachable by command, button and keyboard", async ({ page }) => {
    await run(page, "help");
    await expect(page.locator("#helpPanel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#helpPanel")).toBeHidden();

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("?");
    await expect(page.locator("#helpPanel")).toBeVisible();
  });
});

test.describe("map", () => {
  test("a place lookup opens the map panel", async ({ page }) => {
    await run(page, "map of Cincinnati");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#mapTitle")).toHaveText("Cincinnati");
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("food banks plot markers and a matching text list", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".result-item")).toHaveCount(13);
    await expect(page.locator(".marker-icon").first()).toBeAttached();
    await expect(page.locator(".status-badge").first()).toBeVisible();
  });

  test("3d and 2d switch the basemap in place", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    await run(page, "3d");
    await expect(page.locator('[data-role="basemap"]')).toHaveText("3d terrain");
    await run(page, "2d");
    await expect(page.locator('[data-role="basemap"]')).toHaveText("black map");
  });

  test("a radius filter without a location explains itself", async ({ page }) => {
    await page.context().clearPermissions();
    await run(page, "food banks within 10 miles");
    await expect(page.locator(".toast")).toContainText(/location/i, { timeout: 15000 });
  });

  test("a radius filter with a location narrows the results", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 39.3438, longitude: -84.5356 }); // Fairfield, OH
    await run(page, "food banks within 10 miles");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    const count = await page.locator(".result-item").count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(13);
    await expect(page.locator(".result-meta").first()).toContainText("mi away");
  });

  test("a place that cannot be geocoded reports the failure", async ({ page }) => {
    await stubNetwork(page, { geocode: "empty" });
    await run(page, "map of Xyzzyville");
    await expect(page.locator(".toast")).toContainText("No place matched");
    await expect(page.locator(".map-panel")).toHaveCount(0);
  });

  test("the map closes back to the core", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    await page.locator('[data-role="close"]').click();
    await expect(page.locator(".map-panel")).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator("#statusLabel")).toHaveText("listening");
  });
});

test.describe("accessibility", () => {
  test("the colour-vision palette can be switched by command and persists", async ({ page }) => {
    await run(page, "deuteranopia");
    await expect(page.locator("html")).toHaveAttribute("data-vision", "deuteranopia");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-vision", "deuteranopia");
  });

  test("every palette keeps the status colours distinct", async ({ page }) => {
    const modes = ["default", "universal", "deuteranopia", "protanopia", "tritanopia", "monochrome"];
    for (const mode of modes) {
      await page.evaluate((value) => window.firus.accessibility.set({ vision: value }), mode);
      const palette = await page.evaluate(() => window.firus.accessibility.palette());
      const statuses = [palette.open, palette.closed, palette.appointment, palette.unknown];
      expect(new Set(statuses).size, `palette ${mode} has duplicate status colours`).toBe(statuses.length);
    }
  });

  test("marker colour follows the palette", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".marker-icon").first()).toBeAttached({ timeout: 15000 });
    await page.evaluate(() => window.firus.accessibility.set({ vision: "universal" }));

    // Which shapes are on screen depends on the wall clock, so assert that every
    // marker fill is a colour from the active palette rather than naming one.
    const { fills, palette } = await page.evaluate(() => ({
      fills: [...document.querySelectorAll(".marker-icon svg [fill]")]
        .map((node) => node.getAttribute("fill").toLowerCase())
        .filter((fill) => fill !== "none" && fill !== "#000"),
      palette: window.firus.accessibility.palette()
    }));

    const allowed = new Set(
      [palette.open, palette.closed, palette.appointment, palette.unknown, palette.user].map((value) =>
        value.toLowerCase()
      )
    );
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(allowed, `unexpected marker fill ${fill}`).toContain(fill);
  });

  test("high contrast and text size apply", async ({ page }) => {
    await run(page, "high contrast");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await run(page, "large text");
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    const fontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(fontSize).toBe("19px");
  });

  test("reduced motion skips the zoom animation", async ({ page }) => {
    await run(page, "reduce motion");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    const started = Date.now();
    await run(page, "show");
    await expect(page.locator(".particle-field")).toBeVisible({ timeout: 5000 });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("the settings panel is operable from the keyboard", async ({ page }) => {
    await page.locator("#settingsButton").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#settingsPanel")).toBeVisible();
    await expect(page.locator("#settingsPanel input[type=radio]:checked")).toBeFocused();
    await page.locator("#prefHighContrast").check();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.keyboard.press("Escape");
    await expect(page.locator("#settingsPanel")).toBeHidden();
    await expect(page.locator("#settingsButton")).toBeFocused();
  });

  test("statuses are announced in words, not colour alone", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".result-item").first()).toBeVisible({ timeout: 15000 });
    const badges = await page.locator(".status-badge").allTextContents();
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge).toMatch(/Open now|Closed now|By appointment|Hours unknown/);
    }
  });
});

test.describe("contrast", () => {
  const PALETTES = ["default", "universal", "deuteranopia", "protanopia", "tritanopia", "monochrome"];

  /** Resolves CSS custom properties to sRGB and returns WCAG contrast vs black. */
  async function contrastAgainstBlack(page, tokens) {
    return page.evaluate((names) => {
      const parse = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const channel = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const luminance = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

      const probe = document.createElement("span");
      document.body.appendChild(probe);
      const out = names.map((token) => {
        probe.style.color = `var(${token})`;
        const value = (luminance(parse(getComputedStyle(probe).color)) + 0.05) / 0.05;
        return [token, Number(value.toFixed(2))];
      });
      probe.remove();
      return out;
    }, tokens);
  }

  test("body text clears WCAG AA against the black background in every palette", async ({ page }) => {
    for (const vision of PALETTES) {
      await page.evaluate((value) => window.firus.accessibility.set({ vision: value }), vision);
      const results = await contrastAgainstBlack(page, ["--text", "--text-muted", "--text-faint", "--text-strong"]);
      for (const [token, value] of results) {
        expect(value, `${token} in the ${vision} palette`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("status colours clear the 3:1 non-text contrast floor", async ({ page }) => {
    for (const vision of PALETTES) {
      await page.evaluate((value) => window.firus.accessibility.set({ vision: value }), vision);
      const results = await contrastAgainstBlack(page, [
        "--status-open",
        "--status-closed",
        "--status-appointment",
        "--status-unknown",
        "--status-user"
      ]);
      for (const [token, value] of results) {
        expect(value, `${token} in the ${vision} palette`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

test.describe("layout", () => {
  test("nothing overflows horizontally", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the map panel fits the viewport", async ({ page }) => {
    await run(page, "food banks");
    await expect(page.locator(".map-panel")).toBeVisible({ timeout: 15000 });
    const box = await page.locator(".map-panel").boundingBox();
    const viewport = page.viewportSize();
    expect(box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
  });
});
