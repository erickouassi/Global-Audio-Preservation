const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

async function redisKeys(pattern) {
  const res = await fetch(`${redisUrl}/keys/${pattern}`, {
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const data = await res.json();
  return data.result || [];
}

async function redisSet(key, value) {
  await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keys = await redisKeys("audio_count_*");
  for (const key of keys) {
    await redisSet(key, 0);
  }

  return res.status(200).json({ message: "All counts reset", total: keys.length });
}
