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

      function clearTransitionTimer() {
        if (transitionTimer !== null) {
          window.clearTimeout(transitionTimer);
          transitionTimer = null;
        }
      }

      function createReactivePulse() {
        reactivePulse.innerHTML = "";
        for (let i = 0; i < 2; i += 1) {
          const ring = document.createElement("div");
          ring.className = "reactive-ring";
          reactivePulse.appendChild(ring);
        }

        const conic = document.createElement("div");
        conic.className = "reactive-conic";
        reactivePulse.appendChild(conic);

        for (let tick = 0; tick < PARTICLE_COUNTS.ticks; tick += 1) {
          const angle = tick * (360 / PARTICLE_COUNTS.ticks);
          const holder = document.createElement("div");
          holder.className = "tick-holder";
          holder.style.transform = `rotate(${angle}deg)`;
          const line = document.createElement("div");
          line.className = tick % 4 === 0 ? "tick major" : "tick minor";
          line.style.animationDelay = `${tick * 0.035}s`;
          holder.appendChild(line);
          reactivePulse.appendChild(holder);
        }
      }

      function setStatus(nextStatus) {
        status = nextStatus;
        coreShell.classList.toggle("responding", status === "responding");
        reactivePulse.hidden = !(status === "responding" && visualMode === "core");
        updateLabel();
      }

      function setVisualMode(nextMode) {
        visualMode = nextMode;
        app.classList.toggle("zooming", visualMode === "zoom");
        coreShell.classList.toggle("hidden-for-zoom", visualMode === "zoom");
        coreShell.classList.toggle("hidden-for-field", visualMode === "field");
        coreShell.classList.toggle("reassembling", visualMode === "reassemble");
        reactivePulse.hidden = !(status === "responding" && visualMode === "core");
        commandInput.placeholder = visualMode === "field" ? 'Type "reset" to return to Firus...' : 'Type "show" or "map of Columbus, Ohio"...';
        updateLabel();
      }

      function updateLabel() {
        statusLabel.textContent = visualMode === "core" ? statusCopy[status] : statusCopy[visualMode];
      }

      function toggleVoiceState(event) {
        if (event.target.closest("[data-command-ui='true'], input, button")) return;
        if (visualMode !== "core") return;
        setStatus(status === "responding" ? "listening" : "responding");
      }

      function removeLayer(selector) {
        document.querySelectorAll(selector).forEach((node) => node.remove());
      }

      function createZoomLayer() {
        removeLayer(".zoom-layer");
        const layer = document.createElement("div");
        layer.className = "zoom-layer";

        const flash = document.createElement("div");
        flash.className = "zoom-flash";
        layer.appendChild(flash);

        const ring = document.createElement("div");
        ring.className = "zoom-ring";
        layer.appendChild(ring);

        const burst = document.createElement("div");
        burst.className = "zoom-core-burst";
        layer.appendChild(burst);

        const vignette = document.createElement("div");
        vignette.className = "zoom-vignette";
        layer.appendChild(vignette);

        for (let i = 0; i < 4; i += 1) {
          const depthRing = document.createElement("div");
          depthRing.className = "zoom-depth-ring";
          depthRing.style.animationDelay = `${i * 0.09}s`;
          depthRing.style.setProperty("--ring-opacity", `${0.28 - i * 0.045}`);
          depthRing.style.setProperty("--ring-scale", `${2.4 + i * 0.62}`);
          layer.appendChild(depthRing);
        }

        for (let index = 0; index < PARTICLE_COUNTS.streaks; index += 1) {
          const angle = (index / PARTICLE_COUNTS.streaks) * Math.PI * 2;
          const radius = 18 + (index % 12) * 10;
          const spread = 7.5 + (index % 6) * 0.7;
          const startX = Math.cos(angle) * radius;
          const startY = Math.sin(angle) * radius;
          const endX = Math.cos(angle) * radius * spread;
          const endY = Math.sin(angle) * radius * spread;
          const rotate = (angle * 180) / Math.PI;
          const opacity = 0.16 + (index % 5) * 0.05;

          const streak = document.createElement("div");
          streak.className = "streak";
          streak.style.width = `${72 + (index % 6) * 32}px`;
          streak.style.height = `${index % 7 === 0 ? 2 : 1.2}px`;
          streak.style.animationDelay = `${(index % 14) * 0.012}s`;
          streak.style.setProperty("--sx", `${startX}px`);
          streak.style.setProperty("--sy", `${startY}px`);
          streak.style.setProperty("--ex", `${endX}px`);
          streak.style.setProperty("--ey", `${endY}px`);
          streak.style.setProperty("--rot", `${rotate}deg`);
          streak.style.setProperty("--o", opacity);
          layer.appendChild(streak);
        }

        for (let index = 0; index < 54; index += 1) {
          const angle = (index / 54) * Math.PI * 2 + (index % 3) * 0.18;
          const startDistance = 8 + (index % 8) * 9;
          const endDistance = 260 + (index % 12) * 34;
          const startX = Math.cos(angle) * startDistance;
          const startY = Math.sin(angle) * startDistance;
          const endX = Math.cos(angle) * endDistance;
          const endY = Math.sin(angle) * endDistance;
          const size = 1 + (index % 4) * 0.55;

          const dust = document.createElement("div");
          dust.className = "zoom-dust";
          dust.style.width = `${size}px`;
          dust.style.height = `${size}px`;
          dust.style.animationDelay = `${(index % 18) * 0.017}s`;
          dust.style.setProperty("--sx", `${startX}px`);
          dust.style.setProperty("--sy", `${startY}px`);
          dust.style.setProperty("--ex", `${endX}px`);
          dust.style.setProperty("--ey", `${endY}px`);
          dust.style.setProperty("--o", `${0.18 + (index % 5) * 0.06}`);
          dust.style.setProperty("--s", `${0.8 + (index % 4) * 0.18}`);
          layer.appendChild(dust);
        }

        for (let index = 0; index < 22; index += 1) {
          const angle = (index / 22) * Math.PI * 2 + 0.11;
          const startDistance = 36 + (index % 6) * 15;
          const endDistance = 330 + (index % 7) * 42;
          const startX = Math.cos(angle) * startDistance;
          const startY = Math.sin(angle) * startDistance;
          const endX = Math.cos(angle) * endDistance;
          const endY = Math.sin(angle) * endDistance;
          const rotate = (angle * 180) / Math.PI;

          const shard = document.createElement("div");
          shard.className = "zoom-shard";
          shard.style.width = `${90 + (index % 5) * 34}px`;
          shard.style.animationDelay = `${0.08 + (index % 12) * 0.018}s`;
          shard.style.setProperty("--sx", `${startX}px`);
          shard.style.setProperty("--sy", `${startY}px`);
          shard.style.setProperty("--ex", `${endX}px`);
          shard.style.setProperty("--ey", `${endY}px`);
          shard.style.setProperty("--rot", `${rotate}deg`);
          shard.style.setProperty("--o", `${0.14 + (index % 4) * 0.055}`);
          layer.appendChild(shard);
        }

        document.body.appendChild(layer);
      }

      function createParticleField() {
        removeLayer(".particle-field");
        const field = document.createElement("div");
        field.className = "particle-field";

        const ring = document.createElement("div");
        ring.className = "field-ring";
        field.appendChild(ring);

        for (let index = 0; index < PARTICLE_COUNTS.field; index += 1) {
          const layer = index % 5;
          const angle = (index / PARTICLE_COUNTS.field) * Math.PI * 2 * (1.8 + layer * 0.08);
          const distance = 34 + ((index * 31) % 260);
          const shapeBias = 0.72 + layer * 0.08;
          const x = Math.cos(angle) * distance * shapeBias;
          const y = Math.sin(angle) * distance * (0.72 + (index % 4) * 0.08);
          const size = 1.2 + (index % 5) * 0.45;
          const opacity = 0.16 + (index % 7) * 0.055;

          const particle = document.createElement("div");
          particle.className = "field-particle";
          particle.style.width = `${size}px`;
          particle.style.height = `${size}px`;
          particle.style.opacity = opacity;
          particle.style.transform = `translate(${x}px, ${y}px)`;
          field.appendChild(particle);
        }
        voiceCore.appendChild(field);
      }

      function createReassembleField() {
        removeLayer(".reassemble-field");
        removeLayer(".particle-field");
        const field = document.createElement("div");
        field.className = "reassemble-field";

        for (let index = 0; index < PARTICLE_COUNTS.reassemble; index += 1) {
          const angle = (index / PARTICLE_COUNTS.reassemble) * Math.PI * 2;
          const distance = 180 + (index % 8) * 30;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          const size = 1.4 + (index % 4) * 0.55;
          const opacity = 0.2 + (index % 5) * 0.06;

          const particle = document.createElement("div");
          particle.className = "reassemble-particle";
          particle.style.width = `${size}px`;
          particle.style.height = `${size}px`;
          particle.style.animationDelay = `${(index % 12) * 0.014}s`;
          particle.style.setProperty("--x", `${x}px`);
          particle.style.setProperty("--y", `${y}px`);
          particle.style.setProperty("--o", opacity);
          field.appendChild(particle);
        }
        voiceCore.appendChild(field);
      }

      function extractMapLocation(command) {
        const text = command.trim().toLowerCase();
        const original = command.trim();

        if (text.startsWith("where is ")) {
          return original.slice(9).replace(/[.!?]+$/g, "").trim();
        }

        if (!text.includes("map")) return "";

        const prefixes = [
          "show me a map of ",
          "show me map of ",
          "show map of ",
          "show a map of ",
          "open a map of ",
          "open map of ",
          "pull up a map of ",
          "pull up map of ",
          "display a map of ",
          "display map of ",
          "map of ",
          "map for ",
          "map to ",
          "map in ",
          "map near ",
          "map around "
        ];

        for (const prefix of prefixes) {
          if (text.startsWith(prefix)) {
            return original.slice(prefix.length).replace(/[.!?]+$/g, "").trim();
          }
        }

        const fallback = original
          .split(" ")
          .filter((word) => !["show", "me", "a", "the", "map", "of", "for", "to", "in", "near", "around", "open", "display"].includes(word.toLowerCase()))
          .join(" ")
          .replace(/[.!?]+$/g, "")
          .trim();

        return fallback.length > 1 ? fallback : "";
      }

      function createMapPanel(location) {
        removeLayer(".map-panel");
        const panel = document.createElement("div");
        panel.className = "map-panel";

        const safeLocation = location.replace(/[<>]/g, "");
        const mapSrc = "https://maps.google.com/maps?q=" + encodeURIComponent(safeLocation) + "&z=13&output=embed";

        panel.innerHTML = `
          <div class="map-header">
            <div>
              <div class="map-kicker">map response</div>
              <div class="map-title">${safeLocation}</div>
            </div>
            <div class="map-status">live embed</div>
          </div>
          <div class="map-frame-wrap">
            <iframe title="Map of ${safeLocation}" src="${mapSrc}" loading="eager" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
        `;

        voiceCore.appendChild(panel);
      }

      function runCommand(rawCommand = commandInput.value) {
        const normalized = rawCommand.trim().toLowerCase();
        if (!normalized) return;
        clearTransitionTimer();

        const mapLocation = extractMapLocation(normalized);
        if (mapLocation) {
          setStatus("responding");
          setVisualMode("zoom");
          commandInput.value = "";
          createZoomLayer();

          transitionTimer = window.setTimeout(() => {
            removeLayer(".zoom-layer");
            removeLayer(".particle-field");
            createMapPanel(mapLocation);
            setVisualMode("field");
            transitionTimer = null;
          }, ZOOM_PHASE_DURATION_MS);
          return;
        }

        if (normalized.includes("show")) {
          setStatus("responding");
          setVisualMode("zoom");
          commandInput.value = "";
          createZoomLayer();

          transitionTimer = window.setTimeout(() => {
            removeLayer(".zoom-layer");
            createParticleField();
            setVisualMode("field");
            transitionTimer = null;
          }, ZOOM_PHASE_DURATION_MS);
          return;
        }

        if (normalized.includes("reset") || normalized.includes("return") || normalized.includes("back")) {
          removeLayer(".map-panel");
          setStatus("responding");
          setVisualMode("reassemble");
          commandInput.value = "";
          createReassembleField();

          transitionTimer = window.setTimeout(() => {
            removeLayer(".reassemble-field");
            setVisualMode("core");
            setStatus("listening");
            transitionTimer = null;
          }, 1050);
          return;
        }

        setStatus(status === "responding" ? "listening" : "responding");
        commandInput.value = "";
      }

      function getSpeechRecognitionConstructor() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
      }

      function startVoiceCommand() {
        const SpeechRecognition = getSpeechRecognitionConstructor();
        if (!SpeechRecognition || isListeningForSpeech) return;

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          isListeningForSpeech = true;
          voiceButton.textContent = "listening";
          setStatus("listening");
        };

        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || "";
          commandInput.value = transcript;
          runCommand(transcript);
        };

        recognition.onend = () => {
          isListeningForSpeech = false;
          voiceButton.textContent = "voice";
        };

        recognition.onerror = () => {
          isListeningForSpeech = false;
          voiceButton.textContent = "voice";
        };

        recognition.start();
      }

      function boot() {
        createReactivePulse();
        setStatus("listening");
        setVisualMode("core");

        if (!getSpeechRecognitionConstructor()) {
          voiceButton.disabled = true;
          voiceButton.title = "Speech recognition is not supported in this browser.";
        }

        app.addEventListener("click", toggleVoiceState);
        sendButton.addEventListener("click", () => runCommand());
        commandInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") runCommand();
        });
        voiceButton.addEventListener("click", startVoiceCommand);
      }

      boot();
