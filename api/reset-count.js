const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await redisSet(countKey, 0);

  return res.status(200).json({ message: "Count reset", id, count: 0 });
}
