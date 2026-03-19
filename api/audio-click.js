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

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const countKey = `audio_count_${id}`;
  const nextPingKey = `audio_nextPing_${id}`;
  const lastPlayedKey = `audio_lastPlayed_${id}`;

  if (req.method === "GET") {
    const count = parseInt((await redisGet(countKey)) || "0", 10);
    const nextPing = await redisGet(nextPingKey);
    const lastPlayed = await redisGet(lastPlayedKey);
    return res.status(200).json({ count, nextPing, lastPlayed });
  }

  if (req.method === "POST") {
    const currentCount = parseInt((await redisGet(countKey)) || "0", 10);
    const newCount = currentCount + 1;
    await redisSet(countKey, newCount);

    const now = new Date();
    const todayIso = now.toISOString();
    const nextPing = addDays(now, 90).toISOString();

    await redisSet(lastPlayedKey, todayIso);
    await redisSet(nextPingKey, nextPing);

    return res.status(200).json({
      count: newCount,
      nextPing,
      lastPlayed: todayIso
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
