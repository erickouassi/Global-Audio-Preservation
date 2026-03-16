import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

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

    const nextPing = await redis.get(pingKey);

    // Skip if nextPing is still in the future
    if (nextPing && today < nextPing) {
      results.push({ id, action: "skipped", nextPing });
      continue;
    }

    try {
      // HEAD request to keep audio alive
      await fetch(audio.mp3, { method: "HEAD" });

      const now = new Date();
      const next = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const newNextPing = next.toISOString().split("T")[0];

      await redis.set(pingKey, newNextPing);
      await redis.set(lastPlayedKey, today);

      results.push({ id, action: "pinged", newNextPing });
    } catch (err) {
      results.push({ id, action: "error", error: err.message });
    }
  }

  res.status(200).json({ date: today, results });
}
