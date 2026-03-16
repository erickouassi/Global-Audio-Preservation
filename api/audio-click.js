import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const countKey = `audio_count_${id}`;
  const nextPingKey = `audio_nextPing_${id}`;
  const lastPlayedKey = `audio_lastPlayed_${id}`;

  if (req.method === "GET") {
    const count = (await redis.get(countKey)) || 0;
    const nextPing = await redis.get(nextPingKey);
    const lastPlayed = await redis.get(lastPlayedKey);

    return res.status(200).json({
      count,
      nextPing,
      lastPlayed
    });
  }

  if (req.method === "POST") {
    const current = (await redis.get(countKey)) || 0;
    const newCount = current + 1;

    await redis.set(countKey, newCount);

    const now = new Date();
    const today = now.toISOString();
    const next = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const nextPing = next.toISOString();

    await redis.set(lastPlayedKey, today);
    await redis.set(nextPingKey, nextPing);

    return res.status(200).json({
      count: newCount,
      nextPing,
      lastPlayed: today
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
