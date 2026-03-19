/* ============================================================
   CORE HELPERS
============================================================ */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

async function getState(id) {
  const res = await fetch(`/api/audio-click?id=${id}`);
  if (!res.ok) throw new Error("Failed to fetch audio state");
  return res.json();
}

async function registerPlay(id) {
  const res = await fetch(`/api/audio-click?id=${id}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to register play");
  return res.json();
}

async function resetCount(id) {
  const res = await fetch(`/api/reset-count?id=${id}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset count");
  return res.json();
}

async function resetAllCounts() {
  const res = await fetch(`/api/reset-all`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset all counts");
  return res.json();
}

function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

function getStatus(nextPing) {
  if (!nextPing) return "critical";
  const today = new Date();
  const pingDate = new Date(nextPing);
  const diff = daysBetween(today, pingDate);
  if (diff >= 60) return "healthy";
  if (diff >= 15) return "warning";
  return "critical";
}

function createCountdownBar(daysLeft, totalWindow = 90) {
  if (typeof daysLeft !== "number" || isNaN(daysLeft)) return "";
  const clamped = Math.max(0, Math.min(totalWindow, daysLeft));
  const pct = Math.round((clamped / totalWindow) * 100);
  return `
    <div style="margin-top:6px;">
      <div style="height:6px;border-radius:999px;background:#eee;overflow:hidden;">
        <div style="height:6px;width:${pct}%;background:#0078ff;"></div>
      </div>
      <div style="font-size:11px;color:#666;margin-top:2px;">
        ${daysLeft} days until expiration
      </div>
    </div>
  `;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ============================================================
   ENHANCED PLAYER UI (Reusable)
============================================================ */

function createEnhancedPlayerHTML(audio, idPrefix) {
  return `
    <div class="player-ui" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
      <audio id="${idPrefix}-${audio.id}" src="${audio.mp3}"></audio>

      <!-- Row 1: Controls -->
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:12px;">
        <button class="play-btn"
          style="background:#0078ff;color:white;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
          ▶ Play
        </button>

        <button class="mute-btn"
          style="background:#555;color:white;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
          🔇 Mute
        </button>

        <label>🔊 Vol
          <input type="range" min="0" max="1" step="0.05" class="vol-slider">
        </label>

        <label>⏩ Speed
          <select class="speed-select">
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </label>

        <span class="now-playing-pill"
          style="display:none;padding:2px 8px;border-radius:999px;background:#0078ff;color:white;">
          NOW PLAYING
        </span>

        <span class="just-played" style="display:none;color:#0078ff;">
          Last played just now
        </span>
      </div>

      <!-- Row 2: Progress + Time -->
      <div style="display:flex;flex-direction:column;gap:4px;">
        <input type="range" min="0" max="100" value="0" class="progress-slider"
          style="width:100%;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;">
          <span class="current-time">00:00</span>
          <span class="duration">00:00</span>
        </div>
      </div>

      <!-- Row 3: Waveform -->
      <div class="waveform" style="display:flex;gap:2px;height:16px;align-items:flex-end;">
        ${Array.from({ length: 20 }).map(() =>
          `<div class="bar" style="width:4px;background:#ccc;border-radius:2px;height:${4 + Math.random()*12}px;"></div>`
        ).join("")}
      </div>
    </div>
  `;
}

/**
 * Attaches logic to a player container.
 * Returns the audio element so callers (like dashboard) can add extra listeners.
 */
function attachEnhancedPlayerLogic(container, audio, idPrefix) {
  const audioEl = container.querySelector(`#${idPrefix}-${audio.id}`);
  const playBtn = container.querySelector(".play-btn");
  const muteBtn = container.querySelector(".mute-btn");
  const volSlider = container.querySelector(".vol-slider");
  const speedSelect = container.querySelector(".speed-select");
  const nowPill = container.querySelector(".now-playing-pill");
  const justPlayed = container.querySelector(".just-played");
  const bars = Array.from(container.querySelectorAll(".waveform .bar"));
  const progressSlider = container.querySelector(".progress-slider");
  const currentTimeEl = container.querySelector(".current-time");
  const durationEl = container.querySelector(".duration");

  // Initial defaults
  audioEl.volume = 1;
  volSlider.value = "1";
  audioEl.playbackRate = 1;
  speedSelect.value = "1";

  /* Play / Pause toggle */
  playBtn.onclick = () => {
    if (audioEl.paused) {
      audioEl.play();
    } else {
      audioEl.pause();
    }
  };

  audioEl.addEventListener("play", () => {
    playBtn.textContent = "⏸ Pause";
    nowPill.style.display = "inline-block";
  });

  audioEl.addEventListener("pause", () => {
    playBtn.textContent = "▶ Play";
    nowPill.style.display = "none";
  });

  /* Mute toggle */
  muteBtn.onclick = () => {
    audioEl.muted = !audioEl.muted;
    muteBtn.textContent = audioEl.muted ? "🔊 Unmute" : "🔇 Mute";
  };

  /* Volume */
  volSlider.oninput = () => {
    audioEl.volume = parseFloat(volSlider.value);
    if (audioEl.volume === 0) {
      audioEl.muted = true;
      muteBtn.textContent = "🔊 Unmute";
    } else {
      audioEl.muted = false;
      muteBtn.textContent = "🔇 Mute";
    }
  };

  /* Speed */
  speedSelect.onchange = () => {
    audioEl.playbackRate = parseFloat(speedSelect.value);
  };

  /* Duration (once metadata is loaded) */
  audioEl.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audioEl.duration);
  });

  /* Timeupdate: waveform, progress, current time, play count */
  audioEl.addEventListener("timeupdate", async () => {
    const t = audioEl.currentTime;
    const d = audioEl.duration || 0;

    // Waveform animation
    bars.forEach((bar, i) => {
      const factor = Math.abs(Math.sin(t * 4 + i));
      bar.style.height = `${4 + factor * 12}px`;
      bar.style.background = "#0078ff";
    });

    // Time display
    currentTimeEl.textContent = formatTime(t);

    // Progress slider (0–100)
    if (d > 0 && !progressSlider._dragging) {
      const pct = (t / d) * 100;
      progressSlider.value = pct;
    }

    // Count play once after 1 second
    if (t > 1 && !audioEl._counted) {
      audioEl._counted = true;

      await registerPlay(audio.id);

      justPlayed.style.display = "inline";
      setTimeout(() => justPlayed.style.display = "none", 3000);
    }
  });

  /* Seek support */
  progressSlider.addEventListener("input", () => {
    // Mark as dragging so timeupdate doesn't fight the slider
    progressSlider._dragging = true;
  });

  progressSlider.addEventListener("change", () => {
    const d = audioEl.duration || 0;
    const pct = parseFloat(progressSlider.value);
    if (d > 0) {
      audioEl.currentTime = (pct / 100) * d;
    }
    progressSlider._dragging = false;
  });

  /* Ended */
  audioEl.addEventListener("ended", () => {
    playBtn.textContent = "▶ Play";
    nowPill.style.display = "none";
    currentTimeEl.textContent = "00:00";
    progressSlider.value = 0;
  });

  return audioEl;
}

/* ============================================================
   RANDOM EPISODE PLAYER (Enhanced)
============================================================ */

async function loadRandomEpisode() {
  const randomPlayerEl = document.getElementById("randomPlayer");
  if (!randomPlayerEl) return;

  try {
    const audios = await fetchJson("audio.json");
    const random = audios[Math.floor(Math.random() * audios.length)];

    randomPlayerEl.innerHTML = `
      <section class="episode-card">
        <h2>🎧 Random Episode</h2>
        <h3>${random.title}</h3>
        <p>${random.note || ""}</p>

        ${createEnhancedPlayerHTML(random, "rand-audio")}
      </section>
    `;

    attachEnhancedPlayerLogic(randomPlayerEl, random, "rand-audio");

  } catch (err) {
    randomPlayerEl.innerHTML = "<p>Failed to load random episode.</p>";
  }
}

/* ============================================================
   PLAYLIST (Enhanced)
============================================================ */

async function loadPlaylist() {
  const playlistEl = document.getElementById("playlist");
  if (!playlistEl) return;

  const audios = await fetchJson("audio.json");
  playlistEl.innerHTML = "";

  audios.forEach(audio => {
    const card = document.createElement("section");
    card.className = "episode-card";

    card.innerHTML = `
      <h3>${audio.title}</h3>
      <p>${audio.note || ""}</p>
      ${createEnhancedPlayerHTML(audio, "pl-audio")}
    `;

    attachEnhancedPlayerLogic(card, audio, "pl-audio");
    playlistEl.appendChild(card);
  });
}

/* ============================================================
   DASHBOARD (Enhanced)
============================================================ */

async function loadUI() {
  const dashboardEl = document.getElementById("dashboard");
  if (!dashboardEl) return;

  try {
    const audios = await fetchJson("audio.json");
    dashboardEl.innerHTML = "";

    const today = new Date();

    for (const audio of audios) {
      const state = await getState(audio.id);

      const status = getStatus(state.nextPing);
      const daysLeft = state.nextPing
        ? daysBetween(today, new Date(state.nextPing))
        : 0;

      const daysSince = state.lastPlayed
        ? daysBetween(new Date(state.lastPlayed), today)
        : "—";

      const dashCard = document.createElement("section");
      dashCard.className = "dash-card";

      dashCard.innerHTML = `
        <h3>${audio.title}</h3>

        <p><strong>Plays:</strong> ${state.count || 0}</p>
        <p><strong>Expires:</strong> ${state.nextPing || "—"} (${daysLeft} days left)</p>
        <p><strong>Last Played:</strong> ${state.lastPlayed || "—"} (${daysSince === "—" ? "—" : daysSince + " days ago"})</p>

        ${createCountdownBar(daysLeft)}

        <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
          <span class="status ${status}">${status.toUpperCase()}</span>

          <button class="reset-btn"
            style="background:#c62828;color:white;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
            Reset
          </button>
        </div>

        ${createEnhancedPlayerHTML(audio, "dash-audio")}
      `;

      const audioEl = attachEnhancedPlayerLogic(dashCard, audio, "dash-audio");

      const resetBtn = dashCard.querySelector(".reset-btn");
      resetBtn.onclick = async () => {
        const confirmReset = confirm(`Reset play count for "${audio.title}"?`);
        if (!confirmReset) return;
        await resetCount(audio.id);
        await loadUI();
      };

      // Refresh dashboard AFTER playback ends (no auto-stop mid-play)
      audioEl.addEventListener("ended", async () => {
        await loadUI();
      });

      dashboardEl.appendChild(dashCard);
    }
  } catch (err) {
    dashboardEl.innerHTML = "<p>Failed to load dashboard.</p>";
  }
}

/* ============================================================
   GLOBAL INIT
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.onclick = async () => {
      const confirmReset = confirm("Reset ALL play counts?");
      if (!confirmReset) return;
      await resetAllCounts();
      await loadUI();
    };
  }

  loadRandomEpisode();
  loadPlaylist();
  loadUI();
});
