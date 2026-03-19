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

/* ============================================================
   ENHANCED PLAYER UI (Reusable)
============================================================ */

function createEnhancedPlayerHTML(audio, idPrefix) {
  return `
    <div class="player-ui" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
      <audio id="${idPrefix}-${audio.id}" src="${audio.mp3}"></audio>

      <div style="display:flex;align-items:center;gap:12px;font-size:12px;">
        <button class="play-btn"
          style="background:#0078ff;color:white;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
          ▶ Play
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

      <div class="waveform" style="display:flex;gap:2px;height:16px;align-items:flex-end;">
        ${Array.from({ length: 20 }).map(() =>
          `<div class="bar" style="width:4px;background:#ccc;border-radius:2px;height:${4 + Math.random()*12}px;"></div>`
        ).join("")}
      </div>
    </div>
  `;
}

function attachEnhancedPlayerLogic(container, audio, idPrefix) {
  const audioEl = container.querySelector(`#${idPrefix}-${audio.id}`);
  const playBtn = container.querySelector(".play-btn");
  const volSlider = container.querySelector(".vol-slider");
  const speedSelect = container.querySelector(".speed-select");
  const nowPill = container.querySelector(".now-playing-pill");
  const justPlayed = container.querySelector(".just-played");
  const bars = Array.from(container.querySelectorAll(".waveform .bar"));

  playBtn.onclick = () => audioEl.play();
  volSlider.oninput = () => audioEl.volume = parseFloat(volSlider.value);
  speedSelect.onchange = () => audioEl.playbackRate = parseFloat(speedSelect.value);

  audioEl.addEventListener("play", () => {
    nowPill.style.display = "inline-block";
  });

  audioEl.addEventListener("pause", () => {
    nowPill.style.display = "none";
  });

  audioEl.addEventListener("timeupdate", async () => {
    const t = audioEl.currentTime;

    bars.forEach((bar, i) => {
      const factor = Math.abs(Math.sin(t * 4 + i));
      bar.style.height = `${4 + factor * 12}px`;
      bar.style.background = "#0078ff";
    });

    if (t > 1 && !audioEl._counted) {
      audioEl._counted = true;

      await registerPlay(audio.id);

      justPlayed.style.display = "inline";
      setTimeout(() => justPlayed.style.display = "none", 3000);
    }
  });

  audioEl.addEventListener("ended", () => {
    nowPill.style.display = "none";
  });
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

      attachEnhancedPlayerLogic(dashCard, audio, "dash-audio");

      const resetBtn = dashCard.querySelector(".reset-btn");
      resetBtn.onclick = async () => {
        const confirmReset = confirm(`Reset play count for "${audio.title}"?`);
        if (!confirmReset) return;
        await resetCount(audio.id);
        await loadUI();
      };

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
