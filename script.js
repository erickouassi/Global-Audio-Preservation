const dashboardEl = document.getElementById("dashboard");

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

function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

function getStatus(nextPing) {
  if (!nextPing) return "critical";

  const today = new Date();
  const pingDate = new Date(nextPing);
  const diff = daysBetween(today, pingDate);

  if (diff >= 30) return "healthy";
  if (diff >= 1) return "warning";
  return "critical";
}

async function loadRandomEpisode() {
  try {
    const audios = await fetchJson("audio.json");

    const random = audios[Math.floor(Math.random() * audios.length)];
    const state = await getState(random.id);

    const container = document.getElementById("randomPlayer");

    container.innerHTML = `
      <section class="audio-card random-card">
        <h2>🎧 Random Episode</h2>
        <h3>${random.title}</h3>
        <p><strong>Published:</strong> ${random.published}</p>

        <audio id="randomAudio" controls src="${random.mp3}" data-id="${random.id}"></audio>

        <p><strong>Plays:</strong> ${state.count || 0}</p>
        <p><strong>Last Played:</strong> ${state.lastPlayed || "—"}</p>
      </section>
    `;

    const player = document.getElementById("randomAudio");
    player.addEventListener("play", async () => {
      try {
        await registerPlay(random.id);
      } catch (e) {
        console.error(e);
      }
    });

  } catch (err) {
    console.error("Random episode failed:", err);
    const container = document.getElementById("randomPlayer");
    container.innerHTML = "<p>Failed to load random episode.</p>";
  }
}

async function loadUI() {
  try {
    const audios = await fetchJson("audio.json");
    dashboardEl.innerHTML = "";

    for (const audio of audios) {
      const state = await getState(audio.id);

      const status = getStatus(state.nextPing);
      const daysLeft = state.nextPing
        ? daysBetween(new Date(), new Date(state.nextPing))
        : "—";

      const daysSince = state.lastPlayed
        ? daysBetween(new Date(state.lastPlayed), new Date())
        : "—";

      const dashCard = document.createElement("section");
      dashCard.className = "dash-card";
      dashCard.innerHTML = `
        <h3>${audio.title}</h3>
        <p><strong>Plays:</strong> ${state.count || 0}</p>
        <p><strong>Next Ping:</strong> ${state.nextPing || "—"} (${daysLeft} days left)</p>
        <p><strong>Last Played:</strong> ${state.lastPlayed || "—"} (${daysSince} days ago)</p>
        <span class="status ${status}">${status.toUpperCase()}</span>
      `;

      dashboardEl.appendChild(dashCard);
    }

  } catch (err) {
    console.error(err);
    dashboardEl.innerHTML = "<p>Failed to load dashboard.</p>";
  }
}

loadRandomEpisode();
loadUI();
