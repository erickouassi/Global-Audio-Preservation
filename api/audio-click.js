const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

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

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const countKey = `audio_count_${id}`;
  const nextPingKey = `audio_nextPing_${id}`;
  const lastPlayedKey = `audio_lastPlayed_${id}`;

  if (req.method === "GET") {
    const count = (await redisGet(countKey)) || 0;
    const nextPing = await redisGet(nextPingKey);
    const lastPlayed = await redisGet(lastPlayedKey);

    return res.status(200).json({ count, nextPing, lastPlayed });
  }

  if (req.method === "POST") {
    const current = (await redisGet(countKey)) || 0;
    const newCount = current + 1;

    await redisSet(countKey, newCount);

    const now = new Date();
    const today = now.toISOString();
    const next = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const nextPing = next.toISOString();

    await redisSet(lastPlayedKey, today);
    await redisSet(nextPingKey, nextPing);

    return res.status(200).json({
      count: newCount,
      nextPing,
      lastPlayed: today
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
