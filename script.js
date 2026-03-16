const audioListEl = document.getElementById("audioList");
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

async function loadUI() {
  try {
    const audios = await fetchJson("audio.json");
    audioListEl.innerHTML = "";
    dashboardEl.innerHTML = "";

    for (const audio of audios) {
      const state = await getState(audio.id);

      const playerCard = document.createElement("section");
      playerCard.className = "audio-card";

      playerCard.innerHTML = `
        <h3>${audio.title}</h3>
        <p><strong>Published:</strong> ${audio.published}</p>
        <audio controls src="${audio.mp3}" data-id="${audio.id}"></audio>
        <p><strong>Plays:</strong> ${state.count || 0}</p>
        <p><strong>Next Ping:</strong> ${state.nextPing || "—"}</p>
        <p><strong>Last Played:</strong> ${state.lastPlayed || "—"}</p>
      `;

      audioListEl.appendChild(playerCard);

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

    document.querySelectorAll("audio").forEach(player => {
      player.addEventListener("play", async () => {
        const id = player.getAttribute("data-id");
        try {
          await registerPlay(id);
          await loadUI();
        } catch (e) {
          console.error(e);
        }
      });
    });
  } catch (err) {
    console.error(err);
    audioListEl.innerHTML = "<p>Failed to load audio list.</p>";
    dashboardEl.innerHTML = "<p>Failed to load dashboard.</p>";
  }
}

loadUI();
