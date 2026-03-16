const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${redisUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` }
  });
}

import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const filePath = path.join(process.cwd(), "audio.json");
  const file = fs.readFileSync(filePath, "utf8");
  const audios = JSON.parse(file);

  const today = new Date().toISOString().split("T")[0];
  const results = [];

  for (const audio of audios) {
    const id = audio.id;

    const pingKey = `audio_nextPing_${id}`;
    const lastPlayedKey = `audio_lastPlayed_${id}`;

    const nextPing = await redisGet(pingKey);

    if (nextPing && today < nextPing) {
      results.push({ id, action: "skipped", nextPing });
      continue;
    }

    try {
      await fetch(audio.mp3, { method: "HEAD" });

      const now = new Date();
      const next = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const newNextPing = next.toISOString().split("T")[0];

      await redisSet(pingKey, newNextPing);
      await redisSet(lastPlayedKey, today);

      results.push({ id, action: "pinged", newNextPing });
    } catch (err) {
      results.push({ id, action: "error", error: err.message });
    }
  }

  res.status(200).json({ date: today, results });
}
