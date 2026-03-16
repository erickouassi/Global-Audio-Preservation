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

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const countKey = `audio_count_${id}`;
  const nextPingKey = `audio_nextPing_${id}`;
  const lastPlayedDayKey = `audio_lastPlayedDay_${id}`;
  const publishedKey = `audio_published_${id}`;

  if (req.method === "GET") {
    const count = parseInt(await redisGet(countKey) || "0", 10);
    const nextPing = await redisGet(nextPingKey);
    const lastPlayed = await redisGet(lastPlayedDayKey);
    return res.status(200).json({ count, nextPing, lastPlayed });
  }

  if (req.method === "POST") {
    // 1. Increment play count
    const currentCount = parseInt(await redisGet(countKey) || "0", 10);
    const newCount = currentCount + 1;
    await redisSet(countKey, newCount);

    // 2. Determine today's date
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 3. Check if we already bumped today
    const lastPlayedDay = await redisGet(lastPlayedDayKey);

    if (lastPlayedDay !== today) {
      // First play of the day → bump nextPing by 1 day
      const currentNextPing = new Date(await redisGet(nextPingKey));
      const bumped = new Date(currentNextPing.getTime() + 24 * 60 * 60 * 1000);

      await redisSet(nextPingKey, bumped.toISOString());
      await redisSet(lastPlayedDayKey, today);
    }

    return res.status(200).json({
      count: newCount,
      nextPing: await redisGet(nextPingKey),
      lastPlayed: today
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
