const dashboardEl = document.getElementById("dashboard");
const randomPlayerEl = document.getElementById("randomPlayer");

/* ------------------------------
   Core helpers
------------------------------ */

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

/* ------------------------------
   Random Episode Player
------------------------------ */

async function loadRandomEpisode() {
  if (!randomPlayerEl) return;

  try {
    const audios = await fetchJson("audio.json");
    const random = audios[Math.floor(Math.random() * audios.length)];
    const state = await getState(random.id);

    randomPlayerEl.innerHTML = `
      <section class="audio-card random-card">
        <h2>🎧 Random Episode</h2>
        <h3>${random.title}</h3>
        <p><strong>Published:</strong> ${random.published || "—"}</p>

        <audio id="randomAudio" controls src="${random.mp3}" data-id="${random.id}"></audio>

        <p><strong>Plays:</strong> ${state.count || 0}</p>
        <p><strong>Last Played:</strong> ${state.lastPlayed || "—"}</p>
      </section>
    `;

    const player = document.getElementById("randomAudio");

    // Count a play once per load after 1 second of listening
    player.addEventListener("timeupdate", async () => {
      if (player.currentTime > 1 && !player._counted) {
        player._counted = true;
        try {
          await registerPlay(random.id);
        } catch (e) {
          console.error("Failed to register play:", e);
        }
      }
    });
  } catch (err) {
    console.error("Random episode failed:", err);
    randomPlayerEl.innerHTML = "<p>Failed to load random episode.</p>";
  }
}

/* ------------------------------
   Dashboard
------------------------------ */

async function loadUI() {
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
        <span class="status ${status}">${status.toUpperCase()}</span>
        <button class="reset-btn" data-id="${audio.id}">
          Reset Count
        </button>
      `;

      const resetBtn = dashCard.querySelector(".reset-btn");
      resetBtn.onclick = async () => {
        const confirmReset = confirm(`Reset play count for "${audio.title}"? This cannot be undone.`);
        if (!confirmReset) return;
        try {
          await resetCount(audio.id);
          await loadUI();
        } catch (e) {
          console.error("Reset failed:", e);
        }
      };

      dashboardEl.appendChild(dashCard);
    }
  } catch (err) {
    console.error(err);
    dashboardEl.innerHTML = "<p>Failed to load dashboard.</p>";
  }
}

/* ------------------------------
   Global init
------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.onclick = async () => {
      const confirmReset = confirm("Reset play counts for ALL audios? This cannot be undone.");
      if (!confirmReset) return;
      try {
        await resetAllCounts();
        await loadUI();
      } catch (e) {
        console.error("Reset all failed:", e);
      }
    };
  }

  loadRandomEpisode();
  loadUI();
});
